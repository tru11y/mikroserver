import { ConflictException, ForbiddenException } from "@nestjs/common";
import { AuditAction, UserRole, UserStatus } from "@prisma/client";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  const createService = () => {
    const prisma = {
      $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
      refreshToken: {
        updateMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const authService = {
      hashPassword: jest.fn(),
    };
    const auditService = {
      log: jest.fn(),
    };

    const service = new UsersService(
      prisma as never,
      authService as never,
      auditService as never,
    );

    return { service, prisma, authService, auditService };
  };

  it("normalizes reseller creation input and returns effective permissions", async () => {
    const { service, prisma, authService, auditService } = createService();
    prisma.user.findUnique.mockResolvedValue(null);
    authService.hashPassword.mockResolvedValue("hashed-password");
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      email: "reseller@example.com",
      firstName: "Awa",
      lastName: "Traore",
      phone: null,
      role: UserRole.RESELLER,
      status: UserStatus.ACTIVE,
      permissionProfile: "RESELLER_STANDARD",
      permissions: [],
      lastLoginAt: null,
      createdAt: new Date("2026-03-16T10:00:00.000Z"),
    });

    const result = await service.create(
      {
        email: "  RESELLER@EXAMPLE.COM  ",
        firstName: "  Awa ",
        lastName: " Traore  ",
        password: "MikroServer2026!",
        role: UserRole.RESELLER,
        phone: "   ",
        permissionProfile: " reseller_standard ",
      },
      { sub: "admin-1", role: UserRole.ADMIN },
    );

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "reseller@example.com" },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "reseller@example.com",
          firstName: "Awa",
          lastName: "Traore",
          phone: null,
          permissionProfile: "RESELLER_STANDARD",
          permissions: [],
        }),
      }),
    );
    expect(result.permissions).toEqual(
      expect.arrayContaining([
        "tickets.create",
        "tickets.verify",
        "reports.view",
      ]),
    );
    expect(result.permissions).not.toContain("users.manage");
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: AuditAction.CREATE,
        entityType: "User",
        entityId: "user-1",
      }),
    );
  });

  it("prevents sensitive account creation through standard user management", async () => {
    const { service } = createService();

    await expect(
      service.create(
        {
          email: "admin@example.com",
          firstName: "Fatou",
          lastName: "Dia",
          password: "MikroServer2026!",
          role: UserRole.ADMIN,
        },
        { sub: "admin-1", role: UserRole.ADMIN },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.create(
        {
          email: "super@example.com",
          firstName: "Root",
          lastName: "Owner",
          password: "MikroServer2026!",
          role: UserRole.SUPER_ADMIN,
        },
        { sub: "super-1", role: UserRole.SUPER_ADMIN },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects suspension and deletion of protected or self accounts", async () => {
    const { service, prisma } = createService();

    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "super-1",
        email: "super@mikroserver.com",
        role: UserRole.SUPER_ADMIN,
      })
      .mockResolvedValueOnce({
        id: "admin-1",
        email: "admin@mikroserver.com",
        role: UserRole.ADMIN,
      });

    await expect(service.suspend("super-1", "admin-1")).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      service.softDelete("admin-1", "admin-1"),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("refuses permission customization for super admin accounts", async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: "super-1",
      email: "super@mikroserver.local",
      role: UserRole.SUPER_ADMIN,
      permissionProfile: null,
      permissions: [],
    });

    await expect(
      service.updateAccess(
        "super-1",
        { permissionProfile: "SUPERVISOR", permissions: [] },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("updates a reseller profile with normalized identity fields", async () => {
    const { service, prisma, auditService } = createService();
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "reseller-1",
        email: "reseller@example.com",
        firstName: "Awa",
        lastName: "Traore",
        phone: null,
        role: UserRole.RESELLER,
        status: UserStatus.ACTIVE,
        permissionProfile: "RESELLER_STANDARD",
        permissions: [],
        lastLoginAt: null,
        createdAt: new Date("2026-03-16T10:00:00.000Z"),
      })
      .mockResolvedValueOnce(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue({
      id: "reseller-1",
      email: "new.reseller@example.com",
      firstName: "Awa Marie",
      lastName: "Traore",
      phone: "+22501020304",
      role: UserRole.RESELLER,
      status: UserStatus.ACTIVE,
      permissionProfile: "RESELLER_STANDARD",
      permissions: [],
      lastLoginAt: null,
      createdAt: new Date("2026-03-16T10:00:00.000Z"),
    });

    const result = await service.updateProfile(
      "reseller-1",
      {
        email: "  NEW.RESELLER@example.com ",
        firstName: " Awa Marie ",
        phone: " +22501020304 ",
      },
      { sub: "admin-1", role: UserRole.ADMIN },
    );

    expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, {
      where: { email: "new.reseller@example.com" },
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "reseller-1" },
        data: expect.objectContaining({
          email: "new.reseller@example.com",
          firstName: "Awa Marie",
          lastName: "Traore",
          phone: "+22501020304",
        }),
      }),
    );
    expect(result.email).toBe("new.reseller@example.com");
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: AuditAction.UPDATE,
        entityType: "User",
        entityId: "reseller-1",
      }),
    );
  });

  it("resets a reseller password and revokes active refresh tokens", async () => {
    const { service, prisma, authService, auditService } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: "reseller-1",
      email: "reseller@example.com",
      role: UserRole.RESELLER,
      status: UserStatus.ACTIVE,
    });
    authService.hashPassword.mockResolvedValue("new-bcrypt-hash");
    prisma.user.update.mockResolvedValue({ id: "reseller-1" });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.resetPassword(
      "reseller-1",
      "MikroServerReset2026!",
      { sub: "super-1", role: UserRole.SUPER_ADMIN },
    );

    expect(authService.hashPassword).toHaveBeenCalledWith(
      "MikroServerReset2026!",
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "reseller-1", isRevoked: false },
      }),
    );
    expect(result).toEqual({ success: true });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "super-1",
        action: AuditAction.UPDATE,
        entityType: "User",
        entityId: "reseller-1",
      }),
    );
  });
});
