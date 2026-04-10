import { GatewayTimeoutException } from "@nestjs/common";
import { RouterStatus, VoucherStatus } from "@prisma/client";
import { RouterApiService } from "./router-api.service";

describe("RouterApiService - hotspot user enrichment", () => {
  const createService = () => {
    const prisma = {
      router: {
        findUniqueOrThrow: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      voucher: {
        findMany: jest.fn(),
      },
    };

    const configService = {
      get: jest.fn((key: string, defaultValue?: number) => {
        const values: Record<string, number> = {
          MIKROTIK_API_TIMEOUT_MS: 10000,
          MIKROTIK_API_HEALTH_TIMEOUT_MS: 10000,
          MIKROTIK_API_LIVE_TIMEOUT_MS: 20000,
          MIKROTIK_API_HEAVY_READ_TIMEOUT_MS: 30000,
          MIKROTIK_API_WRITE_TIMEOUT_MS: 15000,
        };

        return values[key] ?? defaultValue;
      }),
    };

    const service = new RouterApiService(
      prisma as never,
      configService as never,
    );

    return { service, prisma };
  };

  it("enriches managed hotspot users with first connection and expiry compliance", async () => {
    const { service, prisma } = createService();
    const now = new Date("2026-03-24T09:30:00.000Z");
    jest.useFakeTimers().setSystemTime(now);

    prisma.router.findUniqueOrThrow.mockResolvedValue({
      wireguardIp: "10.66.66.2",
      apiPort: 8728,
      apiUsername: "api",
      apiPasswordHash: "secret",
      hotspotServer: "hotspot1",
    });

    jest.spyOn(service as any, "executeOnRouterResult").mockResolvedValue([
      {
        id: "*1",
        username: "ticket-001",
        profile: "7-Jours",
        comment: null,
        disabled: false,
        active: true,
        activeSessionCount: 1,
        activeAddress: "10.10.10.12",
        activeMacAddress: "AA:BB:CC:DD:EE:11",
        uptime: "00:40:00",
        limitUptime: "7d 00:00:00",
        managedByMikroServer: false,
        planName: null,
        planDurationMinutes: null,
        voucherStatus: null,
        firstConnectionAt: null,
        elapsedSinceFirstConnectionMinutes: null,
        voucherExpiresAt: null,
        remainingMinutes: null,
        isTariffExpired: null,
        enforcementStatus: "UNMANAGED",
      },
    ]);

    prisma.voucher.findMany.mockResolvedValue([
      {
        code: "ticket-001",
        status: VoucherStatus.ACTIVE,
        activatedAt: new Date("2026-03-24T08:15:00.000Z"),
        expiresAt: new Date("2026-03-24T10:15:00.000Z"),
        session: { startedAt: new Date("2026-03-24T08:15:00.000Z") },
        plan: { name: "7 Jours", durationMinutes: 120 },
      },
    ]);

    const result = await service.getHotspotUsers("router-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        username: "ticket-001",
        managedByMikroServer: true,
        planName: "7 Jours",
        enforcementStatus: "ACTIVE_OK",
      }),
    );
    expect(result[0]?.firstConnectionAt?.toISOString()).toBe(
      "2026-03-24T08:15:00.000Z",
    );
    expect(result[0]?.elapsedSinceFirstConnectionMinutes).toBe(75);
    expect(result[0]?.remainingMinutes).toBe(45);

    jest.useRealTimers();
  });

  it("flags expired managed users still active as EXPIRED_BUT_ACTIVE", async () => {
    const { service, prisma } = createService();
    const now = new Date("2026-03-24T09:30:00.000Z");
    jest.useFakeTimers().setSystemTime(now);

    prisma.router.findUniqueOrThrow.mockResolvedValue({
      wireguardIp: "10.66.66.2",
      apiPort: 8728,
      apiUsername: "api",
      apiPasswordHash: "secret",
      hotspotServer: "hotspot1",
    });

    jest.spyOn(service as any, "executeOnRouterResult").mockResolvedValue([
      {
        id: "*2",
        username: "ticket-expired",
        profile: "1-Jour",
        comment: null,
        disabled: false,
        active: true,
        activeSessionCount: 1,
        activeAddress: "10.10.10.22",
        activeMacAddress: "AA:BB:CC:DD:EE:22",
        uptime: "01:20:00",
        limitUptime: "1d 00:00:00",
        managedByMikroServer: false,
        planName: null,
        planDurationMinutes: null,
        voucherStatus: null,
        firstConnectionAt: null,
        elapsedSinceFirstConnectionMinutes: null,
        voucherExpiresAt: null,
        remainingMinutes: null,
        isTariffExpired: null,
        enforcementStatus: "UNMANAGED",
      },
    ]);

    prisma.voucher.findMany.mockResolvedValue([
      {
        code: "ticket-expired",
        status: VoucherStatus.ACTIVE,
        activatedAt: new Date("2026-03-24T06:00:00.000Z"),
        expiresAt: new Date("2026-03-24T08:00:00.000Z"),
        session: { startedAt: new Date("2026-03-24T06:00:00.000Z") },
        plan: { name: "1 Jour", durationMinutes: 120 },
      },
    ]);

    const result = await service.getHotspotUsers("router-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        username: "ticket-expired",
        enforcementStatus: "EXPIRED_BUT_ACTIVE",
        isTariffExpired: true,
      }),
    );
    expect(result[0]?.remainingMinutes).toBe(-90);

    jest.useRealTimers();
  });

  it("uses the heavy-read timeout for hotspot user reads", async () => {
    const { service, prisma } = createService();
    const routerTarget = {
      wireguardIp: "10.66.66.2",
      apiPort: 8728,
      apiUsername: "api",
      apiPasswordHash: "secret",
      hotspotServer: "hotspot1",
    };

    prisma.router.findUniqueOrThrow.mockResolvedValue(routerTarget);

    const executeSpy = jest
      .spyOn(service as any, "executeOnRouterTargetResult")
      .mockResolvedValue([]);

    const result = await service.getHotspotUsers("router-1");

    expect(result).toEqual([]);
    expect(executeSpy).toHaveBeenCalledWith(
      routerTarget,
      expect.any(Function),
      30000,
    );
  });

  it("marks the router as degraded and throws GatewayTimeoutException on live stats timeout", async () => {
    const { service, prisma } = createService();
    const routerRecord = {
      id: "router-1",
      wireguardIp: "10.66.66.2",
      apiPort: 8728,
      apiUsername: "api",
      apiPasswordHash: "secret",
      hotspotServer: "hotspot1",
      metadata: { lastSyncError: null },
    };

    prisma.router.findUniqueOrThrow.mockResolvedValue(routerRecord);
    prisma.router.findUnique.mockResolvedValue({
      metadata: { lastSyncError: null },
    });

    jest
      .spyOn(service as any, "fetchHotspotActiveClients")
      .mockRejectedValue(new Error("Socket Timeout"));

    await expect(service.getLiveStats("router-1")).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );

    expect(prisma.router.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "router-1" },
        data: expect.objectContaining({
          status: RouterStatus.DEGRADED,
        }),
      }),
    );
  });
});
