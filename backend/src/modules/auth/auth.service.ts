import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  ConflictException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { addMinutes } from "date-fns";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { normalizeAuthEmail } from "./auth.utils";
import {
  ChangePasswordDto,
  ConfirmPasswordResetDto,
  LoginDto,
  RefreshTokenDto,
  RequestPasswordResetDto,
} from "./dto/login.dto";
import { User, UserRole, UserStatus, AuditAction } from "@prisma/client";
import { resolveUserPermissions } from "./permissions/permissions.constants";
import { AuthPasswordService } from "./auth-password.service";
import { AuthTokenService } from "./auth-token.service";
import { TwoFactorService } from "./two-factor.service";
import { AuthTokens, AuthenticatedUser, LoginResult } from "./auth.types";

export { AuthTokens, AuthenticatedUser };

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
const PASSWORD_RESET_TOKEN_MINUTES = 30;

/**
 * Auth orchestrator — coordinates login, logout, password management, and token refresh.
 *
 * Delegates low-level concerns to:
 * - AuthPasswordService — bcrypt/argon2 hashing and verification
 * - AuthTokenService    — JWT signing, refresh token rotation, family revocation
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly passwordService: AuthPasswordService,
    private readonly tokenService: AuthTokenService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  async login(
    dto: LoginDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<LoginResult> {
    const loginTimestamp = new Date();
    const normalizedEmail = normalizeAuthEmail(dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail, deletedAt: null },
    });

    if (!user) {
      // Constant-time response prevents user enumeration via timing
      await this.passwordService.constantTimeDummy();
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        `Account locked until ${user.lockedUntil.toISOString()}`,
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException("Account not active");
    }

    const { valid: isPasswordValid, shouldUpgradeToBcrypt } =
      await this.passwordService.verifyPassword(
        dto.password,
        user.passwordHash,
      );

    if (!isPasswordValid) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException("Invalid credentials");
    }

    // Transparently upgrade legacy argon2 hashes to bcrypt on successful login.
    if (shouldUpgradeToBcrypt) {
      try {
        const upgradedHash = await this.passwordService.hashPassword(
          dto.password,
        );
        await this.prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: upgradedHash, passwordChangedAt: new Date() },
        });
      } catch {
        // Non-blocking — log userId only, never the error message (M5 security fix).
        this.logger.warn(`Password hash upgrade failed for user ${user.id}`);
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: loginTimestamp,
        lastLoginIp: ipAddress,
      },
    });

    // --- 2FA gate: if enabled, return a temp token instead of full JWT ---
    if (user.twoFactorEnabledAt && user.twoFactorSecret) {
      const tempToken = this.twoFactorService.issueTempToken(user.id);
      return { requiresTwoFactor: true, tempToken };
    }

    const tokens = await this.tokenService.generateTokenPair(
      user,
      ipAddress,
      userAgent,
      uuidv4(), // New family ID for each fresh login
    );

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      entityType: "User",
      entityId: user.id,
      ipAddress,
      userAgent,
      description: `User ${user.email} logged in`,
    });

    return {
      requiresTwoFactor: false,
      user: this.buildAuthenticatedUser({
        ...user,
        lastLoginAt: loginTimestamp,
      }),
      tokens,
    };
  }

  // ---------------------------------------------------------------------------
  // Token Refresh with Rotation
  // ---------------------------------------------------------------------------

  async refreshTokens(
    dto: RefreshTokenDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<AuthTokens> {
    // Throws UnauthorizedException on invalid / expired JWT
    const payload = this.tokenService.verifyRefreshToken(dto.refreshToken);

    const tokenHash = this.tokenService.hashToken(dto.refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException("Refresh token not found");
    }

    if (storedToken.isRevoked) {
      // Token reuse detected — revoke entire family to protect all sessions.
      this.logger.warn(
        `SECURITY ALERT: Refresh token reuse for user ${payload.sub} family ${payload.familyId}`,
      );
      await this.tokenService.revokeTokenFamily(payload.familyId);
      throw new UnauthorizedException(
        "Token reuse detected. All sessions revoked.",
      );
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    if (storedToken.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException("Account not active");
    }

    // Revoke the current token before issuing a new one (rotation).
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    return this.tokenService.generateTokenPair(
      storedToken.user,
      ipAddress,
      userAgent,
      payload.familyId, // Keep the same family — rotation chain
    );
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  async logout(
    userId: string,
    refreshToken: string,
    ipAddress: string,
  ): Promise<void> {
    const tokenHash = this.tokenService.hashToken(refreshToken);

    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.LOGOUT,
      entityType: "User",
      entityId: userId,
      ipAddress,
      description: "User logged out",
    });
  }

  // ---------------------------------------------------------------------------
  // Change Password
  // ---------------------------------------------------------------------------

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ipAddress: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId, deletedAt: null },
    });

    const { valid: isCurrentValid } = await this.passwordService.verifyPassword(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new ConflictException("New password must differ from current");
    }

    const newHash = await this.passwordService.hashPassword(dto.newPassword);

    // Single transaction: update hash + revoke all sessions atomically.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash, passwordChangedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      }),
    ]);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: userId,
      ipAddress,
      description: "Password changed",
    });
  }

  // ---------------------------------------------------------------------------
  // Forgot Password (email + OTP code)
  // ---------------------------------------------------------------------------

  async requestPasswordReset(
    dto: RequestPasswordResetDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ message: string }> {
    const normalizedEmail = normalizeAuthEmail(dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail, deletedAt: null },
    });

    // Always return the same message to prevent user enumeration.
    const genericResponse = {
      message:
        "Si le compte existe, un email de reinitialisation a ete envoye.",
    };

    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.passwordService.constantTimeDummy();
      return genericResponse;
    }

    const now = new Date();
    const expiresAt = addMinutes(now, PASSWORD_RESET_TOKEN_MINUTES);
    const rawToken = randomBytes(32).toString("hex");
    const rawOtpCode = this.generateOtpCode();

    // Invalidate all previous pending reset tokens for this user.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.tokenService.hashToken(rawToken),
        codeHash: this.tokenService.hashToken(rawOtpCode),
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    await this.sendPasswordResetEmail({
      email: user.email,
      firstName: user.firstName,
      token: rawToken,
      otpCode: rawOtpCode,
      expiresAt,
    });

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.SECURITY_ALERT,
      entityType: "PasswordReset",
      entityId: user.id,
      ipAddress,
      userAgent,
      description: "Password reset requested",
    });

    return genericResponse;
  }

  async confirmPasswordReset(
    dto: ConfirmPasswordResetDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ success: boolean }> {
    const tokenHash = this.tokenService.hashToken(dto.token.trim());
    const codeHash = this.tokenService.hashToken(dto.code.trim());

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken)
      throw new UnauthorizedException("Token de reinitialisation invalide");
    if (resetToken.usedAt)
      throw new UnauthorizedException("Token de reinitialisation deja utilise");
    if (resetToken.expiresAt <= new Date())
      throw new UnauthorizedException("Token de reinitialisation expire");
    if (resetToken.codeHash !== codeHash)
      throw new UnauthorizedException("Code OTP invalide");
    if (resetToken.user.status !== UserStatus.ACTIVE)
      throw new ForbiddenException("Compte inactif");

    const nextPasswordHash = await this.passwordService.hashPassword(
      dto.newPassword,
    );
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash: nextPasswordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, isRevoked: false },
        data: { isRevoked: true, revokedAt: now },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: now },
      }),
      // Invalidate any other pending reset tokens for this user.
      this.prisma.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          id: { not: resetToken.id },
          usedAt: null,
        },
        data: { usedAt: now },
      }),
    ]);

    await this.auditService.log({
      userId: resetToken.userId,
      action: AuditAction.SECURITY_ALERT,
      entityType: "PasswordReset",
      entityId: resetToken.userId,
      ipAddress,
      userAgent,
      description: "Password reset completed",
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Profile
  // ---------------------------------------------------------------------------

  async updateProfile(
    userId: string,
    email: string,
  ): Promise<AuthenticatedUser> {
    const normalized = email.trim().toLowerCase();
    // Check for email conflict
    const existing = await this.prisma.user.findFirst({
      where: { email: normalized, id: { not: userId }, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException("Cette adresse email est déjà utilisée.");
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { email: normalized },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        permissionProfile: true,
        permissions: true,
        lastLoginAt: true,
        twoFactorEnabledAt: true,
      },
    });
    return this.buildAuthenticatedUser(user);
  }

  async getProfile(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        permissionProfile: true,
        permissions: true,
        lastLoginAt: true,
        twoFactorEnabledAt: true,
      },
    });
    return this.buildAuthenticatedUser(user);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildAuthenticatedUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    permissionProfile?: string | null;
    permissions?: unknown;
    lastLoginAt: Date | null;
    twoFactorEnabledAt?: Date | null;
  }): AuthenticatedUser {
    return {
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
    };
  }

  private async handleFailedLogin(user: User): Promise<void> {
    const newAttempts = user.failedLoginAttempts + 1;
    const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newAttempts,
        lockedUntil: shouldLock
          ? addMinutes(new Date(), LOCK_DURATION_MINUTES)
          : undefined,
      },
    });

    if (shouldLock) {
      this.logger.warn(
        `Account ${user.email} locked after ${MAX_FAILED_ATTEMPTS} failed attempts`,
      );
    }
  }

  private generateOtpCode(): string {
    // Cryptographically random 6-digit code
    const numericValue = randomBytes(4).readUInt32BE(0) % 1_000_000;
    return String(numericValue).padStart(6, "0");
  }

  private async sendPasswordResetEmail(params: {
    email: string;
    firstName: string;
    token: string;
    otpCode: string;
    expiresAt: Date;
  }): Promise<void> {
    const resendApiKey = this.configService.get<string>("RESEND_API_KEY");
    const resendFromEmail = this.configService.get<string>("RESEND_FROM_EMAIL");
    const appBaseUrl =
      this.configService.get<string>("PASSWORD_RESET_APP_URL") ??
      this.configService.get<string>("CORS_ORIGINS")?.split(",")[0]?.trim() ??
      "http://localhost:3001";

    const resetUrl = `${appBaseUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(params.token)}`;

    if (!resendApiKey || !resendFromEmail) {
      this.logger.warn(
        `Password reset email provider not configured for ${this.maskEmail(params.email)}. OTP generated but not sent.`,
      );
      return;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Reinitialisation du mot de passe</h2>
        <p>Bonjour ${params.firstName || "utilisateur"},</p>
        <p>Utilise ce code OTP pour confirmer la reinitialisation :</p>
        <p style="font-size: 24px; letter-spacing: 4px; font-weight: bold;">${params.otpCode}</p>
        <p>Ce code expire le ${params.expiresAt.toISOString()}.</p>
        <p>Ensuite, ouvre ce lien :</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Si tu n es pas a l origine de cette demande, ignore cet email.</p>
      </div>
    `.trim();

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFromEmail,
          to: [params.email],
          subject: "MikroServer - Reinitialisation mot de passe",
          html,
        }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        this.logger.error(
          `Resend API error during password reset email: ${response.status} ${responseText}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Unable to send password reset email: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private maskEmail(email: string): string {
    const [localPart, domainPart] = email.split("@");
    if (!localPart || !domainPart) return "unknown";
    if (localPart.length <= 2) return `${localPart[0] ?? "*"}***@${domainPart}`;
    return `${localPart.slice(0, 2)}***@${domainPart}`;
  }
}
