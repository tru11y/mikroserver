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
import { SaasService } from "../saas/saas.service";
import { EmailService } from "../notifications/email.service";
import { normalizeAuthEmail } from "./auth.utils";
import {
  ChangePasswordDto,
  ConfirmPasswordResetDto,
  DeleteAccountDto,
  GoogleLoginDto,
  LoginDto,
  RefreshTokenDto,
  RequestPasswordResetDto,
  SignupDto,
  UpdateMeDto,
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
    private readonly saasService: SaasService,
    private readonly emailService: EmailService,
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

    const user = await this.prisma.user.findFirst({
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
        user.passwordHash ?? "",
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
      user.passwordHash ?? "",
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

    const user = await this.prisma.user.findFirst({
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
    const normalizedEmail = normalizeAuthEmail(dto.email);
    const codeHash = this.tokenService.hashToken(dto.code.trim());

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: { user: { email: normalizedEmail }, usedAt: null },
      orderBy: { createdAt: "desc" },
      include: { user: true },
    });

    if (!resetToken)
      throw new UnauthorizedException("Code de reinitialisation invalide");
    if (resetToken.expiresAt <= new Date())
      throw new UnauthorizedException("Code de reinitialisation expire");
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
  // Signup (creates Tenant + OWNER user)
  // ---------------------------------------------------------------------------

  async signup(
    dto: SignupDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<AuthTokens> {
    const normalizedEmail = normalizeAuthEmail(dto.email);
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException("Cette adresse email est déjà utilisée.");
    }

    const passwordHash = await this.passwordService.hashPassword(
      dto.password,
    );
    const slug = await this.generateUniqueTenantSlug(dto.tenantName);

    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName.trim(), slug },
      });
      return tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          firstName: dto.tenantName.trim().slice(0, 100) || "Owner",
          lastName: "",
          role: UserRole.OWNER,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          passwordChangedAt: new Date(),
          tenantId: tenant.id,
        },
      });
    });

    await this.saasService.startTrial(user.id).catch((error: Error) => {
      this.logger.error(
        `Failed to start trial subscription for ${user.email}: ${error.message}`,
      );
    });

    const tokens = await this.tokenService.generateTokenPair(
      user,
      ipAddress,
      userAgent,
      uuidv4(),
    );

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.CREATE,
      entityType: "Tenant",
      entityId: user.tenantId ?? undefined,
      ipAddress,
      userAgent,
      description: `Tenant signup for ${user.email}`,
    });

    return tokens;
  }

  // ---------------------------------------------------------------------------
  // Google OAuth
  // ---------------------------------------------------------------------------

  async googleLogin(
    dto: GoogleLoginDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<AuthTokens> {
    const payload = await this.verifyGoogleIdToken(dto.idToken);

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: payload.sub }, { email: payload.email }],
        deletedAt: null,
      },
    });

    if (user && !user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub },
      });
    }

    if (!user) {
      const slug = await this.generateUniqueTenantSlug(
        payload.name ?? payload.email,
      );
      user = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: payload.name ?? payload.email, slug },
        });
        return tx.user.create({
          data: {
            email: payload.email,
            googleId: payload.sub,
            firstName: (payload.name ?? "Owner").slice(0, 100),
            lastName: "",
            role: UserRole.OWNER,
            status: UserStatus.ACTIVE,
            emailVerifiedAt: new Date(),
            tenantId: tenant.id,
          },
        });
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException("Account not active");
    }

    const tokens = await this.tokenService.generateTokenPair(
      user,
      ipAddress,
      userAgent,
      uuidv4(),
    );

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      entityType: "User",
      entityId: user.id,
      ipAddress,
      userAgent,
      description: `Google login for ${user.email}`,
    });

    return tokens;
  }

  private async verifyGoogleIdToken(
    idToken: string,
  ): Promise<{ sub: string; email: string; name?: string }> {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!response.ok) {
      throw new UnauthorizedException("Jeton Google invalide");
    }
    const data = (await response.json()) as {
      sub: string;
      email: string;
      email_verified: string;
      name?: string;
      aud?: string;
    };
    const expectedAudience = this.configService.get<string>(
      "GOOGLE_OAUTH_CLIENT_ID",
    );
    if (expectedAudience && data.aud !== expectedAudience) {
      throw new UnauthorizedException("Jeton Google invalide");
    }
    if (data.email_verified !== "true" || !data.email) {
      throw new UnauthorizedException("Email Google non vérifié");
    }
    return {
      sub: data.sub,
      email: normalizeAuthEmail(data.email),
      name: data.name,
    };
  }

  // ---------------------------------------------------------------------------
  // Enriched /auth/me (user + tenant + subscription + entitlement)
  // ---------------------------------------------------------------------------

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId, deletedAt: null },
      include: {
        tenant: true,
        operatorSubscription: { include: { tier: true } },
      },
    });

    const entitlement = this.buildEntitlement(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name:
          [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
          null,
        country: user.country,
        role: user.role,
        status: user.status,
        notificationsEnabled: user.notificationsEnabled,
        hasPassword: !!user.passwordHash,
        googleId: user.googleId,
      },
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            status: user.tenant.status,
          }
        : null,
      subscription: user.operatorSubscription
        ? {
            plan: user.operatorSubscription.tier.isFree ? "FREE" : "PRO",
            status: user.operatorSubscription.status,
            currentPeriodEnd: user.operatorSubscription.endDate.toISOString(),
          }
        : null,
      entitlement,
    };
  }

  private buildEntitlement(user: {
    role: UserRole;
    operatorSubscription:
      | ({ tier: { slug: string; maxRouters: number | null } } & {
          status: string;
          endDate: Date;
          trialEndsAt: Date | null;
        })
      | null;
  }) {
    const now = new Date();
    const sub = user.operatorSubscription;

    if (user.role === UserRole.SUPER_ADMIN) {
      return {
        tier: "PRO" as const,
        localAllowed: true,
        remoteAllowed: true,
        endsAt: null,
        daysLeft: 9999,
        tierKey: null,
        routerLimit: null,
      };
    }

    if (!sub || sub.status !== "ACTIVE" || sub.endDate < now) {
      return {
        tier: "LOCKED" as const,
        localAllowed: false,
        remoteAllowed: false,
        endsAt: sub?.endDate.toISOString() ?? null,
        daysLeft: 0,
        tierKey: null,
        routerLimit: null,
      };
    }

    const isTrial = !!sub.trialEndsAt && sub.trialEndsAt > now;
    const daysLeft = Math.max(
      0,
      Math.ceil((sub.endDate.getTime() - now.getTime()) / 86400000),
    );

    return {
      tier: (isTrial ? "TRIAL" : "PRO") as "TRIAL" | "PRO",
      localAllowed: true,
      remoteAllowed: true,
      endsAt: sub.endDate.toISOString(),
      daysLeft,
      tierKey: sub.tier.slug,
      routerLimit: sub.tier.maxRouters,
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const [firstName, ...rest] = (dto.name ?? "").trim().split(/\s+/);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined
          ? { firstName: firstName || "", lastName: rest.join(" ") }
          : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
      },
    });
    const me = await this.getMe(user.id);
    return me.user;
  }

  async updateNotifications(userId: string, enabled: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { notificationsEnabled: enabled },
    });
  }

  async setPassword(userId: string, password: string): Promise<void> {
    const passwordHash = await this.passwordService.hashPassword(password);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
  }

  async registerPushToken(userId: string, token: string): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: token },
      update: { userId },
      create: { userId, endpoint: token, p256dh: "", auth: "" },
    });
  }

  async logoutAllSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId, deletedAt: null },
    });

    if (user.passwordHash && dto.password) {
      const { valid } = await this.passwordService.verifyPassword(
        dto.password,
        user.passwordHash,
      );
      if (!valid) throw new UnauthorizedException("Mot de passe incorrect");
    } else if (user.googleId && dto.googleIdToken) {
      const payload = await this.verifyGoogleIdToken(dto.googleIdToken);
      if (payload.sub !== user.googleId) {
        throw new UnauthorizedException("Jeton Google invalide");
      }
    } else {
      throw new UnauthorizedException("Confirmation requise");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date(), status: UserStatus.SUSPENDED },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      }),
    ]);
  }

  private async generateUniqueTenantSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "tenant";

    let slug = base;
    let suffix = 0;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    return slug;
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
    otpCode: string;
    expiresAt: Date;
  }): Promise<void> {
    const expiresMinutes = Math.round(
      (params.expiresAt.getTime() - Date.now()) / 60000,
    );
    const sent = await this.emailService.sendPasswordReset(
      params.email,
      params.otpCode,
      expiresMinutes,
    );
    if (!sent) {
      this.logger.warn(
        `Password reset email provider not configured for ${this.maskEmail(params.email)}. OTP generated but not sent.`,
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
