import { UnauthorizedException } from "@nestjs/common";
import { AuditAction, UserRole, UserStatus } from "@prisma/client";
import { AuthService } from "./auth.service";

jest.mock("otplib", () => ({
  generateSecret: jest.fn(),
  generateSync: jest.fn(),
  verifySync: jest.fn(),
  generateURI: jest.fn(),
}));

describe("AuthService - password reset flow", () => {
  const createService = () => {
    const prisma = {
      $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
      passwordResetToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const configService = {
      get: jest.fn(),
      getOrThrow: jest.fn(),
    };

    const auditService = {
      log: jest.fn(),
    };

    const passwordService = {
      constantTimeDummy: jest.fn().mockResolvedValue(undefined),
      hashPassword: jest.fn(),
      verifyPassword: jest.fn(),
    };

    const tokenService = {
      hashToken: jest.fn((value: string) => `hash:${value}`),
    };

    const twoFactorService = {
      isTotpEnabled: jest.fn(),
      verifyTotpCode: jest.fn(),
      beginTotpChallenge: jest.fn(),
      createBackupCodes: jest.fn(),
    };

    const service = new AuthService(
      prisma as never,
      configService as never,
      auditService as never,
      passwordService as never,
      tokenService as never,
      twoFactorService as never,
    );

    return {
      service,
      prisma,
      configService,
      auditService,
      passwordService,
      tokenService,
      twoFactorService,
    };
  };

  it("returns a generic success message when account is unknown", async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.requestPasswordReset(
      { email: "unknown@example.com" },
      "127.0.0.1",
      "jest",
    );

    expect(result.message).toContain("Si le compte existe");
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("creates reset token + otp for active account and logs audit event", async () => {
    const { service, prisma, auditService } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "admin@mikroserver.com",
      firstName: "Admin",
      status: UserStatus.ACTIVE,
    });
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.passwordResetToken.create.mockResolvedValue({
      id: "reset-1",
    });

    const sendSpy = jest
      .spyOn(service as any, "sendPasswordResetEmail")
      .mockResolvedValue(undefined);

    const result = await service.requestPasswordReset(
      { email: "admin@mikroserver.com" },
      "127.0.0.1",
      "jest",
    );

    expect(result.message).toContain("Si le compte existe");
    expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "admin@mikroserver.com",
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        action: AuditAction.SECURITY_ALERT,
        entityType: "PasswordReset",
      }),
    );
  });

  it("rejects reset confirmation when otp code is invalid", async () => {
    const { service, prisma, tokenService } = createService();
    const token = "a".repeat(64);
    const validCode = "123456";

    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "reset-1",
      userId: "user-1",
      tokenHash: tokenService.hashToken(token),
      codeHash: tokenService.hashToken(validCode),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      usedAt: null,
      user: {
        id: "user-1",
        status: UserStatus.ACTIVE,
      },
    });

    await expect(
      service.confirmPasswordReset(
        {
          token,
          code: "654321",
          newPassword: "NouveauMotDePasse2026!",
        },
        "127.0.0.1",
        "jest",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("updates password and revokes active sessions on valid reset confirmation", async () => {
    const { service, prisma, auditService, passwordService, tokenService } =
      createService();
    const token = "b".repeat(64);
    const otpCode = "246810";
    const nowPlus30Min = new Date(Date.now() + 30 * 60 * 1000);

    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "reset-1",
      userId: "user-1",
      tokenHash: tokenService.hashToken(token),
      codeHash: tokenService.hashToken(otpCode),
      expiresAt: nowPlus30Min,
      usedAt: null,
      user: {
        id: "user-1",
        email: "admin@mikroserver.com",
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    passwordService.hashPassword.mockResolvedValue("bcrypt-new-hash");
    prisma.user.update.mockResolvedValue({ id: "user-1" });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });
    prisma.passwordResetToken.update.mockResolvedValue({ id: "reset-1" });
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.confirmPasswordReset(
      {
        token,
        code: otpCode,
        newPassword: "NouveauMotDePasse2026!",
      },
      "127.0.0.1",
      "jest",
    );

    expect(result).toEqual({ success: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", isRevoked: false },
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        action: AuditAction.SECURITY_ALERT,
        entityType: "PasswordReset",
      }),
    );
  });
});
