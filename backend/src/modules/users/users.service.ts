import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthPasswordService } from "../auth/auth-password.service";
import { AuditService } from "../audit/audit.service";
import { AuditAction, UserRole, UserStatus } from "@prisma/client";
import {
  AppPermission,
  getPermissionCatalog,
  normalizePermissionProfile,
  resolveUserPermissions,
  sanitizePermissions,
} from "../auth/permissions/permissions.constants";
import { normalizeAuthEmail } from "../auth/auth.utils";
import {
  CreateUserDto,
  UpdateUserAccessDto,
  UpdateUserProfileDto,
} from "./dto/users.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: AuthPasswordService,
    private readonly auditService: AuditService,
  ) {}

  // List all non-deleted users, optional role filter
  async findAll(role?: UserRole) {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, ...(role ? { role } : {}) },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        permissionProfile: true,
        permissions: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return users.map((user) => this.mapUser(user));
  }

  // Paginated user list with search, role filter and counts
  async findAllPaginated(opts: {
    page: number;
    limit: number;
    search?: string;
    role?: UserRole;
  }) {
    const { page, limit, search, role } = opts;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(role ? { role } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" as const } },
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          status: true,
          permissionProfile: true,
          permissions: true,
          lastLoginAt: true,
          createdAt: true,
          _count: {
            select: {
              routersOwned: true,
              vouchers: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((u) => ({
        ...this.mapUser(u),
        _counts: {
          routers: u._count.routersOwned,
          vouchers: u._count.vouchers,
        },
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Generate a random 12-char password, hash and reset
  async generateAndResetPassword(
    id: string,
    actor: { sub: string; role: UserRole },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    this.assertUpdatableTarget(user, actor, "reinitialiser le mot de passe de");

    if (user.id === actor.sub) {
      throw new ConflictException(
        "Utilise le changement de mot de passe personnel pour ton propre compte.",
      );
    }

    const chars = "ABCDEFGHJKMNPQRSTWXYZabcdefghjkmnpqrstwxyz23456789!@#$";
    let tempPassword = "";
    for (let i = 0; i < 12; i++) {
      tempPassword += chars[Math.floor(Math.random() * chars.length)];
    }

    const passwordHash = await this.passwordService.hashPassword(tempPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      }),
    ]);

    await this.auditService.log({
      userId: actor.sub,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: id,
      newValues: {
        passwordReset: true,
        generated: true,
        refreshTokensRevoked: true,
      },
      description: `Password auto-generated and reset for ${user.email}`,
    });

    return { tempPassword };
  }

  // Change user role (SUPER_ADMIN only)
  async changeRole(
    id: string,
    newRole: UserRole,
    actor: { sub: string; role: UserRole },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ConflictException(
        "Le rôle Super Admin ne peut pas être modifié.",
      );
    }
    if (newRole === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        "L'attribution du rôle Super Admin est interdite.",
      );
    }
    if (user.id === actor.sub) {
      throw new ConflictException("Impossible de modifier votre propre rôle.");
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        permissionProfile: true,
        permissions: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    await this.auditService.log({
      userId: actor.sub,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: id,
      oldValues: { role: user.role },
      newValues: { role: newRole },
      description: `Role changed from ${user.role} to ${newRole} for ${user.email}`,
    });

    return this.mapUser(updated);
  }

  // List only resellers
  async findResellers() {
    return this.findAll(UserRole.RESELLER);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        permissionProfile: true,
        permissions: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return this.mapUser(user);
  }

  async create(dto: CreateUserDto, actor: { sub: string; role: UserRole }) {
    this.assertCanCreateRole(dto.role, actor.role);

    const normalizedEmail = normalizeAuthEmail(dto.email);
    const firstName = this.normalizeRequiredString(dto.firstName);
    const lastName = this.normalizeRequiredString(dto.lastName);
    const phone = this.normalizeOptionalString(dto.phone);
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await this.passwordService.hashPassword(dto.password);
    const normalizedProfile = this.resolveStoredPermissionProfile(
      dto.role,
      dto.permissionProfile,
      dto.permissions,
    );
    const explicitPermissions = this.resolveStoredPermissions(dto.permissions);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName,
        phone,
        role: dto.role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        permissionProfile: normalizedProfile,
        permissions: explicitPermissions,
      },
    });

    await this.auditService.log({
      userId: actor.sub,
      action: AuditAction.CREATE,
      entityType: "User",
      entityId: user.id,
      description: `User ${user.email} (${user.role}) created`,
    });

    return this.mapUser(user);
  }

  async updateProfile(
    id: string,
    dto: UpdateUserProfileDto,
    actor: { sub: string; role: UserRole },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    this.assertUpdatableTarget(user, actor, "modifier le profil de");

    const email =
      dto.email === undefined ? user.email : normalizeAuthEmail(dto.email);
    const firstName =
      dto.firstName === undefined
        ? user.firstName
        : this.normalizeRequiredString(dto.firstName);
    const lastName =
      dto.lastName === undefined
        ? user.lastName
        : this.normalizeRequiredString(dto.lastName);
    const phone =
      dto.phone === undefined
        ? (user.phone ?? null)
        : this.normalizeOptionalString(dto.phone);

    if (email !== user.email) {
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingByEmail && existingByEmail.id !== id) {
        throw new ConflictException("Email already registered");
      }
    }

    if (phone && phone !== user.phone) {
      const existingByPhone = await this.prisma.user.findFirst({
        where: {
          phone,
          id: { not: id },
        },
        select: { id: true },
      });
      if (existingByPhone) {
        throw new ConflictException("Phone already registered");
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email,
        firstName,
        lastName,
        phone,
      },
    });

    await this.auditService.log({
      userId: actor.sub,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: id,
      oldValues: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone ?? null,
      },
      newValues: {
        email,
        firstName,
        lastName,
        phone,
      },
      description: `Profile updated for ${updated.email}`,
    });

    return this.mapUser(updated);
  }

  async suspend(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    this.assertManageableTarget(user, adminId, "suspendre");

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.SUSPENDED },
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: id,
      description: `User ${user.email} suspended`,
    });

    return this.mapUser(updated);
  }

  async activate(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    this.assertProtectedTarget(user, "reactiver");

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE },
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: id,
      description: `User ${user.email} re-activated`,
    });

    return this.mapUser(updated);
  }

  async softDelete(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    this.assertManageableTarget(user, adminId, "supprimer");

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.DELETE,
      entityType: "User",
      entityId: id,
      description: `User ${user.email} deleted`,
    });

    return { success: true };
  }

  getPermissionOptions() {
    return getPermissionCatalog();
  }

  async updateAccess(id: string, dto: UpdateUserAccessDto, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    this.assertProtectedTarget(user, "personnaliser");

    const requestedPermissions =
      dto.permissions === undefined ? user.permissions : dto.permissions;
    const requestedProfile =
      dto.permissionProfile === undefined
        ? user.permissionProfile
        : dto.permissionProfile;
    const normalizedProfile = this.resolveStoredPermissionProfile(
      user.role,
      requestedProfile,
      requestedPermissions,
    );
    const explicitPermissions =
      this.resolveStoredPermissions(requestedPermissions);

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        permissionProfile: normalizedProfile,
        permissions: explicitPermissions,
      },
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: id,
      oldValues: {
        permissionProfile: user.permissionProfile,
        permissions: sanitizePermissions(user.permissions),
      },
      newValues: {
        permissionProfile: normalizedProfile,
        permissions: explicitPermissions,
      },
      description: `Permissions updated for ${user.email}`,
    });

    return this.mapUser(updated);
  }

  async resetPassword(
    id: string,
    password: string,
    actor: { sub: string; role: UserRole },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    this.assertUpdatableTarget(user, actor, "reinitialiser le mot de passe de");

    if (user.id === actor.sub) {
      throw new ConflictException(
        "Utilise le changement de mot de passe personnel pour ton propre compte.",
      );
    }

    const passwordHash = await this.passwordService.hashPassword(password);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      }),
    ]);

    await this.auditService.log({
      userId: actor.sub,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: id,
      newValues: {
        passwordReset: true,
        refreshTokensRevoked: true,
      },
      description: `Password reset for ${user.email}`,
    });

    return { success: true };
  }

  private mapUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role: UserRole;
    status: UserStatus;
    permissionProfile?: string | null;
    permissions?: unknown;
    lastLoginAt: Date | null;
    createdAt: Date;
  }) {
    const effectivePermissions = resolveUserPermissions(
      user.role,
      user.permissions,
      user.permissionProfile,
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? null,
      role: user.role,
      status: user.status,
      permissionProfile: user.permissionProfile ?? null,
      permissionOverrides: sanitizePermissions(user.permissions),
      permissions: effectivePermissions,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  private resolveStoredPermissionProfile(
    role: UserRole,
    permissionProfile: string | null | undefined,
    permissions: unknown,
  ): string | null {
    if (role === UserRole.SUPER_ADMIN) {
      return null;
    }

    const explicitPermissions = this.resolveStoredPermissions(permissions);
    if (explicitPermissions.length > 0) {
      return null;
    }

    return (
      normalizePermissionProfile(permissionProfile) ??
      this.getDefaultPermissionProfile(role)
    );
  }

  private resolveStoredPermissions(permissions: unknown): AppPermission[] {
    return sanitizePermissions(permissions);
  }

  private getDefaultPermissionProfile(role: UserRole): string | null {
    switch (role) {
      case UserRole.ADMIN:
        return "ADMIN_STANDARD";
      case UserRole.RESELLER:
        return "RESELLER_STANDARD";
      case UserRole.VIEWER:
      default:
        return "READ_ONLY";
    }
  }

  private normalizeRequiredString(value: string): string {
    return value.trim();
  }

  private normalizeOptionalString(
    value: string | null | undefined,
  ): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private assertCanCreateRole(targetRole: UserRole, actorRole: UserRole): void {
    if (targetRole === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        "La creation d'un Super Admin est reservee au bootstrap securise.",
      );
    }

    if (actorRole !== UserRole.SUPER_ADMIN && targetRole === UserRole.ADMIN) {
      throw new ForbiddenException(
        "Seul un Super Admin peut creer un compte administrateur.",
      );
    }
  }

  private assertProtectedTarget(
    user: { role: UserRole },
    action:
      | "reactiver"
      | "personnaliser"
      | "suspendre"
      | "supprimer"
      | "modifier le profil"
      | "reinitialiser le mot de passe",
  ): void {
    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ConflictException(
        `Le compte Super Admin ne peut pas etre ${action}.`,
      );
    }
  }

  private assertManageableTarget(
    user: { id: string; role: UserRole },
    actorId: string,
    action: "suspendre" | "supprimer",
  ): void {
    this.assertProtectedTarget(user, action);

    if (user.id === actorId) {
      throw new ConflictException(
        `Impossible de ${action} votre propre compte.`,
      );
    }
  }

  private assertUpdatableTarget(
    user: { id: string; role: UserRole },
    actor: { sub: string; role: UserRole },
    action: "modifier le profil de" | "reinitialiser le mot de passe de",
  ): void {
    this.assertProtectedTarget(
      user,
      action === "modifier le profil de"
        ? "modifier le profil"
        : "reinitialiser le mot de passe",
    );

    if (user.role === UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        `Seul un Super Admin peut ${action} un compte administrateur.`,
      );
    }
  }
}
