import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { resolveUserPermissions } from "./permissions/permissions.constants";
import {
  JwtPayload,
  RefreshTokenPayload,
} from "./interfaces/jwt-payload.interface";
import { AuthTokens } from "./auth.types";

// Refresh tokens revoked more than this many days ago are safe to hard-delete.
const REVOKED_TOKEN_RETENTION_DAYS = 30;

/**
 * Manages the full JWT + refresh token lifecycle:
 * - Issuing token pairs (access + refresh)
 * - Hashing tokens for safe DB storage
 * - Revoking token families (on reuse attack or password change)
 * - Verifying incoming refresh tokens
 * - Periodic cleanup of expired / stale tokens (cron every 6 hours)
 */
@Injectable()
export class AuthTokenService {
  private readonly logger = new Logger(AuthTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Signs a new access + refresh token pair, stores the hashed refresh token
   * in the database, and returns both tokens to the caller.
   *
   * Pass the existing familyId on rotation, or uuidv4() for a brand-new login.
   */
  async generateTokenPair(
    user: User,
    ipAddress: string,
    userAgent: string,
    familyId: string,
  ): Promise<AuthTokens> {
    const accessExpiry =
      this.configService.getOrThrow<string>("jwt.accessExpiry");
    const refreshExpiry =
      this.configService.getOrThrow<string>("jwt.refreshExpiry");

    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissionProfile: user.permissionProfile,
      permissions: resolveUserPermissions(
        user.role,
        user.permissions,
        user.permissionProfile,
      ),
    };

    const tokenId = uuidv4();
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      familyId,
      tokenId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload as any, {
        secret: this.configService.getOrThrow<string>("jwt.accessSecret"),
        expiresIn: accessExpiry as any,
      }),
      this.jwtService.signAsync(refreshPayload as any, {
        secret: this.configService.getOrThrow<string>("jwt.refreshSecret"),
        expiresIn: refreshExpiry as any,
      }),
    ]);

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        familyId,
        expiresAt: this.parseExpiryToDate(refreshExpiry),
        userAgent,
        ipAddress,
      },
    });

    return {
      accessToken,
      refreshToken,
      accessExpiresIn: this.parseExpiryToSeconds(accessExpiry),
      refreshExpiresIn: this.parseExpiryToSeconds(refreshExpiry),
    };
  }

  /**
   * Verifies the refresh token JWT signature.
   * Throws UnauthorizedException on invalid or expired tokens.
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return this.jwtService.verify<RefreshTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>("jwt.refreshSecret"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  /** SHA-256 hash a token for safe storage — never store raw tokens in the DB. */
  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /**
   * Parse a JWT expiry string ('15m', '1h', '30d') to total seconds.
   * Falls back to 900 (15 min) on unknown format.
   */
  private parseExpiryToSeconds(expiry: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiry);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * (multipliers[unit] ?? 1);
  }

  /**
   * Parse a JWT expiry string to an absolute Date.
   * Used for setting the DB expiresAt on refresh tokens.
   */
  private parseExpiryToDate(expiry: string): Date {
    const seconds = this.parseExpiryToSeconds(expiry);
    return new Date(Date.now() + seconds * 1000);
  }

  /**
   * Revokes every token in a family.
   * Called when token reuse is detected (possible theft) or on password change.
   * Effectively logs out all active sessions for that login chain.
   */
  async revokeTokenFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  /**
   * Scheduled cleanup — runs every 6 hours.
   * Removes expired PasswordResetTokens and stale revoked RefreshTokens
   * that are older than REVOKED_TOKEN_RETENTION_DAYS days.
   */
  @Cron("0 */6 * * *")
  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();
    const retentionCutoff = new Date(
      now.getTime() - REVOKED_TOKEN_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const [deletedResetTokens, deletedRefreshTokens] = await Promise.all([
      this.prisma.passwordResetToken.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { isRevoked: true, revokedAt: { lt: retentionCutoff } },
          ],
        },
      }),
    ]);

    if (deletedResetTokens.count > 0 || deletedRefreshTokens.count > 0) {
      this.logger.log(
        `Token cleanup: removed ${deletedResetTokens.count} expired reset tokens, ` +
          `${deletedRefreshTokens.count} stale refresh tokens`,
      );
    }
  }
}
