import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { addDays, addMinutes } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  JwtPayload,
  RefreshTokenPayload,
} from './interfaces/jwt-payload.interface';
import { LoginDto, RefreshTokenDto, ChangePasswordDto, UpdateProfileDto } from './dto/login.dto';
import { User, UserRole, UserStatus, AuditAction } from '@prisma/client';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  lastLoginAt: Date | null;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) { }

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  async login(
    dto: LoginDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ user: AuthenticatedUser; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (!user) {
      // Constant-time response to prevent user enumeration
      await this.constantTimeDummy();
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        `Account locked until ${user.lockedUntil.toISOString()}`,
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account not active');
    }

    // Verify password
    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on success
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    const tokens = await this.generateTokenPair(
      user,
      ipAddress,
      userAgent,
      uuidv4(), // New family for new login
    );

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
      description: `User ${user.email} logged in`,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
      },
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
    let payload: RefreshTokenPayload;

    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(dto.refreshToken, {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(dto.refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // CRITICAL: Detect token reuse — possible token theft
    if (storedToken.isRevoked) {
      this.logger.warn(
        `SECURITY ALERT: Refresh token reuse detected for user ${payload.sub} family ${payload.familyId}`,
      );
      // Revoke entire token family (logout all sessions)
      await this.revokeTokenFamily(payload.familyId);
      throw new UnauthorizedException('Token reuse detected. All sessions revoked.');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (storedToken.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account not active');
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    // Issue new token pair (same family = rotation chain)
    return this.generateTokenPair(
      storedToken.user,
      ipAddress,
      userAgent,
      payload.familyId,
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
    const tokenHash = this.hashToken(refreshToken);

    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.LOGOUT,
      entityType: 'User',
      entityId: userId,
      ipAddress,
      description: 'User logged out',
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

    const isCurrentValid = await argon2.verify(
      user.passwordHash,
      dto.currentPassword,
    );

    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new ConflictException('New password must differ from current');
    }

    const newHash = await this.hashPassword(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash, passwordChangedAt: new Date() },
      }),
      // Revoke all refresh tokens on password change
      this.prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      }),
    ]);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: userId,
      ipAddress,
      description: 'Password changed',
    });
  }

  // ---------------------------------------------------------------------------
  // Get full user profile
  // ---------------------------------------------------------------------------

  async getProfile(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, lastLoginAt: true },
    });
    return user;
  }

  // ---------------------------------------------------------------------------
  // Update own profile (name + phone only; email/role require admin)
  // ---------------------------------------------------------------------------

  async updateProfile(userId: string, dto: UpdateProfileDto, ipAddress: string): Promise<AuthenticatedUser> {
    const updated = await this.prisma.user.update({
      where: { id: userId, deletedAt: null },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, lastLoginAt: true },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: userId,
      ipAddress,
      description: 'Profile updated',
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: this.configService.get<number>('security.argon2Memory', 65536),
      timeCost: this.configService.get<number>('security.argon2Iterations', 3),
      parallelism: this.configService.get<number>('security.argon2Parallelism', 4),
    });
  }

  private async generateTokenPair(
    user: User,
    ipAddress: string,
    userAgent: string,
    familyId: string,
  ): Promise<AuthTokens> {
    const accessExpiry = this.configService.getOrThrow<string>('jwt.accessExpiry');
    const refreshExpiry = this.configService.getOrThrow<string>('jwt.refreshExpiry');

    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const tokenId = uuidv4();
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      familyId,
      tokenId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload as any, {
        secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: accessExpiry as any,
      }),
      this.jwtService.signAsync(refreshPayload as any, {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiry as any,
      }),
    ]);

    // Store hashed refresh token
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = addDays(new Date(), 30);

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId: user.id,
        tokenHash,
        familyId,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });

    return {
      accessToken,
      refreshToken,
      accessExpiresIn: 900,    // 15 minutes in seconds
      refreshExpiresIn: 2592000, // 30 days in seconds
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async revokeTokenFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
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

  private async constantTimeDummy(): Promise<void> {
    // Prevent timing attacks on user enumeration
    await argon2.hash('dummy_constant_time_check');
  }
}
