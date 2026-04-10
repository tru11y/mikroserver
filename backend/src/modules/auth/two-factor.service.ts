import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { generateSecret, generateSync, verifySync, generateURI } from "otplib";
import * as QRCode from "qrcode";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuditAction } from "@prisma/client";
import { AuthTokenService } from "./auth-token.service";
import { AuthenticatedUser, AuthTokens } from "./auth.types";
import { resolveUserPermissions } from "./permissions/permissions.constants";
import { v4 as uuidv4 } from "uuid";

/** Claim used to distinguish temp 2FA tokens from real access tokens */
const TWO_FA_TOKEN_TYPE = "2fa_pending";
/** Expiry for the temp token: 5 minutes */
const TEMP_TOKEN_EXPIRY = "5m";

export interface TwoFaSetupResult {
  secret: string;
  qrCodeUrl: string;
  manualEntryCode: string;
}

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly tokenService: AuthTokenService,
  ) {}

  // ---------------------------------------------------------------------------
  // Temp token helpers (issued after password check when 2FA is enabled)
  // ---------------------------------------------------------------------------

  /** Issue a short-lived temp token containing only userId + type claim. */
  issueTempToken(userId: string): string {
    const secret = this.configService.getOrThrow<string>("jwt.accessSecret");
    return this.jwtService.sign(
      { sub: userId, type: TWO_FA_TOKEN_TYPE },
      { secret, expiresIn: TEMP_TOKEN_EXPIRY },
    );
  }

  /**
   * Verify the temp token and extract the userId.
   * Throws UnauthorizedException if invalid, expired, or wrong type.
   */
  verifyTempToken(tempToken: string): string {
    try {
      const secret = this.configService.getOrThrow<string>("jwt.accessSecret");
      const payload = this.jwtService.verify<{ sub: string; type: string }>(
        tempToken,
        { secret },
      );
      if (payload.type !== TWO_FA_TOKEN_TYPE) {
        throw new UnauthorizedException("Token invalide pour la 2FA");
      }
      return payload.sub;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException("Token 2FA invalide ou expire");
    }
  }

  // ---------------------------------------------------------------------------
  // Setup: generate secret + QR code
  // ---------------------------------------------------------------------------

  async setup(userId: string): Promise<TwoFaSetupResult> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId, deletedAt: null },
      select: { email: true, twoFactorEnabledAt: true },
    });

    if (user.twoFactorEnabledAt) {
      throw new BadRequestException(
        "La double authentification est deja activee",
      );
    }

    const secret = generateSecret();
    const appName = this.configService.get<string>("APP_NAME") ?? "MikroServer";
    const otpauth = generateURI({
      secret,
      label: user.email,
      issuer: appName,
    });
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Store the secret (unconfirmed — 2FA not yet enabled until verify-setup)
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return {
      secret,
      qrCodeUrl,
      manualEntryCode: secret,
    };
  }

  // ---------------------------------------------------------------------------
  // Verify setup: confirm TOTP code and enable 2FA
  // ---------------------------------------------------------------------------

  async verifySetup(
    userId: string,
    code: string,
    ipAddress: string,
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId, deletedAt: null },
      select: { twoFactorSecret: true, twoFactorEnabledAt: true },
    });

    if (user.twoFactorEnabledAt) {
      throw new BadRequestException(
        "La double authentification est deja activee",
      );
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException(
        "Lancez dabord la configuration 2FA (/auth/2fa/setup)",
      );
    }

    const result = verifySync({ token: code, secret: user.twoFactorSecret });
    if (!result.valid) {
      throw new UnauthorizedException("Code TOTP invalide");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabledAt: new Date() },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.SECURITY_ALERT,
      entityType: "User",
      entityId: userId,
      ipAddress,
      description: "2FA activee",
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Disable 2FA
  // ---------------------------------------------------------------------------

  async disable(
    userId: string,
    code: string,
    ipAddress: string,
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId, deletedAt: null },
      select: { twoFactorSecret: true, twoFactorEnabledAt: true },
    });

    if (!user.twoFactorEnabledAt || !user.twoFactorSecret) {
      throw new BadRequestException(
        "La double authentification n est pas activee",
      );
    }

    const result = verifySync({ token: code, secret: user.twoFactorSecret });
    if (!result.valid) {
      throw new UnauthorizedException("Code TOTP invalide");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: null, twoFactorEnabledAt: null },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.SECURITY_ALERT,
      entityType: "User",
      entityId: userId,
      ipAddress,
      description: "2FA desactivee",
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Verify TOTP during login (2FA second step)
  // ---------------------------------------------------------------------------

  async verifyLogin(
    tempToken: string,
    code: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ user: AuthenticatedUser; tokens: AuthTokens }> {
    const userId = this.verifyTempToken(tempToken);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId, deletedAt: null },
    });

    if (!user.twoFactorSecret || !user.twoFactorEnabledAt) {
      throw new UnauthorizedException(
        "La 2FA n est pas activee pour ce compte",
      );
    }

    const result = verifySync({ token: code, secret: user.twoFactorSecret });
    if (!result.valid) {
      throw new UnauthorizedException("Code TOTP invalide");
    }

    const tokens = await this.tokenService.generateTokenPair(
      user,
      ipAddress,
      userAgent,
      uuidv4(),
    );

    await this.auditService.log({
      userId,
      action: AuditAction.LOGIN,
      entityType: "User",
      entityId: userId,
      ipAddress,
      userAgent,
      description: `Connexion 2FA validee pour ${user.email}`,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissionProfile: user.permissionProfile ?? null,
        permissions: resolveUserPermissions(
          user.role,
          user.permissions,
          user.permissionProfile,
        ),
        lastLoginAt: user.lastLoginAt,
        twoFactorEnabled: !!user.twoFactorEnabledAt,
      },
      tokens,
    };
  }
}
