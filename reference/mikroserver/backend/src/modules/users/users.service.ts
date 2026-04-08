import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, UserRole, UserStatus } from '@prisma/client';
import { IsEmail, IsString, IsEnum, MinLength, IsOptional, IsPhoneNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(2) firstName!: string;
  @ApiProperty() @IsString() @MinLength(2) lastName!: string;
  @ApiProperty() @IsString() @MinLength(12) password!: string;
  @ApiPropertyOptional({ enum: UserRole }) @IsEnum(UserRole) role: UserRole = UserRole.ADMIN;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  // List all non-deleted users, optional role filter
  async findAll(role?: UserRole) {
    return this.prisma.user.findMany({
      where: { deletedAt: null, ...(role ? { role } : {}) },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
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
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto, createdById: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await this.authService.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: dto.role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });

    await this.auditService.log({
      userId: createdById,
      action: AuditAction.CREATE,
      entityType: 'User',
      entityId: user.id,
      description: `User ${user.email} (${user.role}) created`,
    });

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async suspend(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.SUSPENDED },
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: id,
      description: `User ${user.email} suspended`,
    });

    const { passwordHash: _, ...safeUser } = updated;
    return safeUser;
  }

  async activate(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE },
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: id,
      description: `User ${user.email} re-activated`,
    });

    const { passwordHash: _, ...safeUser } = updated;
    return safeUser;
  }

  async softDelete(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.DELETE,
      entityType: 'User',
      entityId: id,
      description: `User ${user.email} deleted`,
    });

    return { success: true };
  }
}
