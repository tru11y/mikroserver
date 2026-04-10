import { UnauthorizedException } from "@nestjs/common";
import { UserRole, VoucherStatus } from "@prisma/client";
import { VoucherService } from "./voucher.service";

describe("VoucherService legacy verification", () => {
  const createService = () => {
    const prisma = {
      voucher: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      session: {
        updateMany: jest.fn(),
      },
    };
    const queueService = {};
    const configService = {
      get: jest
        .fn()
        .mockImplementation((_key: string, fallback: unknown) => fallback),
    };
    const routerApiService = {
      findLegacyTicket: jest.fn(),
      disconnectActiveSessionsByUsername: jest.fn(),
      removeHotspotUser: jest.fn(),
    };
    const auditService = {
      log: jest.fn(),
    };

    const service = new VoucherService(
      prisma as never,
      queueService as never,
      configService as never,
      routerApiService as never,
      auditService as never,
    );

    return { service, prisma, routerApiService };
  };

  it("falls back to router-side verification for legacy tickets", async () => {
    const { service, prisma, routerApiService } = createService();
    prisma.voucher.findFirst.mockResolvedValue(null);
    routerApiService.findLegacyTicket.mockResolvedValue({
      routerId: "router-1",
      routerName: "OPEN WIFI 0704225955",
      code: "7d8848227",
      active: true,
      disabled: false,
      planName: "1-day",
      durationMinutes: 1440,
      deliveredAt: null,
      activatedAt: new Date("2026-03-14T08:00:00.000Z"),
      expiresAt: new Date("2026-03-15T08:00:00.000Z"),
      passwordMatches: null,
    });

    const result = await service.verifyVoucherForOperator(
      "7d8848227",
      undefined,
      { sub: "admin-1", role: UserRole.SUPER_ADMIN },
    );

    const [codeCandidates] = routerApiService.findLegacyTicket.mock.calls[0];
    expect(codeCandidates).toContain("7d8848227");
    expect(codeCandidates).toContain("7D8848227");
    expect(result.code).toBe("7d8848227");
    expect(result.status).toBe(VoucherStatus.ACTIVE);
    expect(result.canLogin).toBe(true);
    expect(result.routerName).toBe("OPEN WIFI 0704225955");
  });

  it("passes the preferred router id during verification when provided", async () => {
    const { service, prisma, routerApiService } = createService();
    prisma.voucher.findFirst.mockResolvedValue(null);
    routerApiService.findLegacyTicket.mockResolvedValue({
      routerId: "router-2",
      routerName: "OPEN WIFI 2",
      code: "legacy-002",
      active: false,
      disabled: false,
      planName: "legacy",
      durationMinutes: 120,
      deliveredAt: null,
      activatedAt: null,
      expiresAt: null,
      passwordMatches: null,
    });

    await service.verifyVoucherForOperator(
      "legacy-002",
      undefined,
      { sub: "admin-1", role: UserRole.SUPER_ADMIN },
      "router-2",
    );

    expect(prisma.voucher.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          routerId: "router-2",
        }),
      }),
    );
    expect(routerApiService.findLegacyTicket).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      "router-2",
    );
  });

  it("rejects a legacy ticket when the explicit password does not match", async () => {
    const { service, prisma, routerApiService } = createService();
    prisma.voucher.findFirst.mockResolvedValue(null);
    routerApiService.findLegacyTicket.mockResolvedValue({
      routerId: "router-1",
      routerName: "OPEN WIFI 0704225955",
      code: "abc123xy",
      active: false,
      disabled: false,
      planName: "legacy",
      durationMinutes: 60,
      deliveredAt: null,
      activatedAt: null,
      expiresAt: null,
      passwordMatches: false,
    });

    await expect(
      service.verifyVoucherForOperator("abc123xy", "wrong-pass", {
        sub: "admin-1",
        role: UserRole.SUPER_ADMIN,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("bulk deletes only tickets that are still safe to remove", async () => {
    const { service, prisma } = createService();
    prisma.voucher.findMany.mockResolvedValue([
      {
        id: "voucher-safe",
        code: "SAFE-001",
        planId: "plan-1",
        routerId: null,
        status: VoucherStatus.DELIVERED,
        createdById: "admin-1",
        activatedAt: null,
        session: null,
      },
      {
        id: "voucher-used",
        code: "USED-001",
        planId: "plan-1",
        routerId: null,
        status: VoucherStatus.ACTIVE,
        createdById: "admin-1",
        activatedAt: new Date("2026-03-14T10:00:00.000Z"),
        session: null,
      },
    ]);

    const result = await service.bulkDeleteVouchers(
      ["voucher-safe", "voucher-used"],
      { sub: "admin-1", role: UserRole.SUPER_ADMIN },
    );

    expect(prisma.voucher.delete).toHaveBeenCalledTimes(1);
    expect(prisma.voucher.delete).toHaveBeenCalledWith({
      where: { id: "voucher-safe" },
    });
    expect(result.deletedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.skipped[0]?.code).toBe("USED-001");
    expect(result.skipped[0]?.reason).toContain("deja utilise");
  });

  it("reports reseller-protected tickets as skipped instead of aborting the whole batch", async () => {
    const { service, prisma } = createService();
    prisma.voucher.findMany.mockResolvedValue([
      {
        id: "voucher-own",
        code: "OWN-001",
        planId: "plan-1",
        routerId: null,
        status: VoucherStatus.GENERATED,
        createdById: "reseller-1",
        activatedAt: null,
        session: null,
      },
      {
        id: "voucher-foreign",
        code: "FOREIGN-001",
        planId: "plan-1",
        routerId: null,
        status: VoucherStatus.GENERATED,
        createdById: "reseller-2",
        activatedAt: null,
        session: null,
      },
    ]);

    const result = await service.bulkDeleteVouchers(
      ["voucher-own", "voucher-foreign"],
      { sub: "reseller-1", role: UserRole.RESELLER },
    );

    expect(prisma.voucher.delete).toHaveBeenCalledTimes(1);
    expect(result.deleted.map((item) => item.code)).toEqual(["OWN-001"]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.code).toBe("FOREIGN-001");
    expect(result.skipped[0]?.reason).toContain("vos propres tickets");
  });

  it("keeps deleting a safe ticket even if router cleanup fails", async () => {
    const { service, prisma, routerApiService } = createService();
    prisma.voucher.findMany.mockResolvedValue([
      {
        id: "voucher-router",
        code: "ROUTER-001",
        planId: "plan-1",
        routerId: "router-1",
        status: VoucherStatus.DELIVERED,
        createdById: "admin-1",
        activatedAt: null,
        session: null,
      },
    ]);
    routerApiService.disconnectActiveSessionsByUsername.mockRejectedValue(
      new Error("router timeout"),
    );

    const result = await service.bulkDeleteVouchers(["voucher-router"], {
      sub: "admin-1",
      role: UserRole.SUPER_ADMIN,
    });

    expect(
      routerApiService.disconnectActiveSessionsByUsername,
    ).toHaveBeenCalledWith("router-1", "ROUTER-001");
    expect(routerApiService.removeHotspotUser).toHaveBeenCalledWith(
      "router-1",
      "ROUTER-001",
    );
    expect(prisma.voucher.delete).toHaveBeenCalledWith({
      where: { id: "voucher-router" },
    });
    expect(result.deletedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
  });

  it("permanently removes a legacy ticket from the router for admins", async () => {
    const { service, prisma, routerApiService } = createService();
    prisma.voucher.findFirst.mockResolvedValue(null);
    routerApiService.findLegacyTicket.mockResolvedValue({
      routerId: "router-1",
      routerName: "OPEN WIFI 0704225955",
      code: "7d8848227",
      active: true,
      disabled: false,
      planName: "legacy",
      durationMinutes: 60,
      deliveredAt: null,
      activatedAt: new Date("2026-03-14T08:00:00.000Z"),
      expiresAt: new Date("2026-03-14T09:00:00.000Z"),
      passwordMatches: null,
    });

    const result = await service.deleteTicketPermanently(
      "7d8848227",
      undefined,
      { sub: "admin-1", role: UserRole.ADMIN },
      "router-1",
    );

    expect(routerApiService.findLegacyTicket).toHaveBeenCalledWith(
      expect.arrayContaining(["7d8848227"]),
      expect.any(Array),
      "router-1",
    );
    expect(
      routerApiService.disconnectActiveSessionsByUsername,
    ).toHaveBeenCalledWith("router-1", "7d8848227");
    expect(routerApiService.removeHotspotUser).toHaveBeenCalledWith(
      "router-1",
      "7d8848227",
    );
    expect(result.source).toBe("LEGACY");
    expect(result.removedFromRouter).toBe(true);
    expect(result.removedFromDatabase).toBe(false);
  });

  it("preserves history when permanently removing a used SaaS ticket", async () => {
    const { service, prisma, routerApiService } = createService();
    prisma.voucher.findFirst.mockResolvedValue({
      id: "voucher-active",
      code: "MS-ACTIVE-001",
      planId: "plan-1",
      routerId: "router-1",
      status: VoucherStatus.ACTIVE,
      createdById: "admin-1",
      activatedAt: new Date("2026-03-14T10:00:00.000Z"),
      session: { id: "session-1" },
    });

    const result = await service.deleteTicketPermanently(
      "MS-ACTIVE-001",
      undefined,
      { sub: "admin-1", role: UserRole.SUPER_ADMIN },
      "router-1",
    );

    expect(
      routerApiService.disconnectActiveSessionsByUsername,
    ).toHaveBeenCalledWith("router-1", "MS-ACTIVE-001");
    expect(routerApiService.removeHotspotUser).toHaveBeenCalledWith(
      "router-1",
      "MS-ACTIVE-001",
    );
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: {
        voucherId: "voucher-active",
        status: "ACTIVE",
      },
      data: {
        status: "TERMINATED",
        terminatedAt: expect.any(Date),
        terminateReason: "manual_permanent_delete",
      },
    });
    expect(prisma.voucher.update).toHaveBeenCalledWith({
      where: { id: "voucher-active" },
      data: {
        status: VoucherStatus.REVOKED,
        revokedAt: expect.any(Date),
      },
    });
    expect(result.historyPreserved).toBe(true);
    expect(result.removedFromDatabase).toBe(false);
  });
});
