import { SessionStatus, VoucherStatus } from "@prisma/client";
import { syncRouterHotspotActiveClients } from "./router-hotspot-sync.utils";

describe("router hotspot sync utils", () => {
  it("syncs active clients, activates vouchers and disconnects expired managed sessions", async () => {
    const fetchedAt = new Date("2026-03-24T16:00:00.000Z");
    const prisma = {
      voucher: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "voucher-1",
            code: "ticket-1",
            status: VoucherStatus.DELIVERED,
            activatedAt: null,
            expiresAt: null,
            plan: { durationMinutes: 120 },
          },
          {
            id: "voucher-2",
            code: "ticket-2",
            status: VoucherStatus.ACTIVE,
            activatedAt: new Date("2026-03-24T12:00:00.000Z"),
            expiresAt: new Date("2026-03-24T13:00:00.000Z"),
            plan: { durationMinutes: 60 },
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      session: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "session-legacy",
            voucherId: "voucher-legacy",
            status: SessionStatus.ACTIVE,
            startedAt: new Date("2026-03-24T11:00:00.000Z"),
            terminatedAt: null,
            voucher: { id: "voucher-legacy", code: "legacy-ticket" },
          },
        ]),
        update: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue(undefined),
      },
      router: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    const disconnectActiveSession = jest.fn().mockResolvedValue(undefined);
    const logger = { warn: jest.fn() };

    const summary = await syncRouterHotspotActiveClients(
      {
        prisma: prisma as never,
        disconnectActiveSession,
        logger,
      },
      {
        id: "router-1",
        metadata: null,
      },
      [
        {
          ".id": "*1",
          server: "hotspot1",
          user: "ticket-1",
          address: "10.10.10.10",
          "mac-address": "AA:BB:CC:DD:EE:01",
          uptime: "00:05:00",
          "bytes-in": "3000",
          "bytes-out": "2000",
          "packets-in": "10",
          "packets-out": "11",
        },
        {
          ".id": "*2",
          server: "hotspot1",
          user: "ticket-2",
          address: "10.10.10.11",
          "mac-address": "AA:BB:CC:DD:EE:02",
          uptime: "00:03:00",
          "bytes-in": "1000",
          "bytes-out": "500",
          "packets-in": "4",
          "packets-out": "5",
        },
        {
          ".id": "*3",
          server: "hotspot1",
          user: "unknown-ticket",
          address: "10.10.10.12",
          "mac-address": "AA:BB:CC:DD:EE:03",
          uptime: "00:01:00",
          "bytes-in": "200",
          "bytes-out": "100",
          "packets-in": "1",
          "packets-out": "1",
        },
      ],
      fetchedAt,
    );

    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        voucherId: "voucher-1",
        routerId: "router-1",
        mikrotikId: "*1",
        status: SessionStatus.ACTIVE,
      }),
    });
    expect(prisma.voucher.update).toHaveBeenCalledWith({
      where: { id: "voucher-1" },
      data: expect.objectContaining({
        status: VoucherStatus.ACTIVE,
        activatedAt: fetchedAt,
      }),
    });
    expect(prisma.voucher.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["voucher-2"] } },
      data: { status: VoucherStatus.EXPIRED },
    });
    expect(disconnectActiveSession).toHaveBeenCalledWith("router-1", "*2");
    expect(summary).toEqual(
      expect.objectContaining({
        routerId: "router-1",
        activeClients: 3,
        matchedVouchers: 1,
        activatedVouchers: 1,
        disconnectedSessions: 2,
        unmatchedUsers: ["ticket-2", "unknown-ticket"],
      }),
    );
    expect(prisma.router.update).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
