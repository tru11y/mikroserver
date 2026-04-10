import { SessionStatus } from "@prisma/client";
import { SessionsService } from "./sessions.service";

describe("SessionsService", () => {
  const createService = () => {
    const prisma = {
      router: {
        findMany: jest.fn(),
      },
      session: {
        updateMany: jest.fn(),
      },
    };
    const routerApiService = {
      getLiveStats: jest.fn(),
      disconnectActiveSession: jest.fn(),
    };

    const service = new SessionsService(
      prisma as never,
      routerApiService as never,
    );

    return { service, prisma, routerApiService };
  };

  it("aggregates active sessions, sorts them by bytes in, and reports router errors", async () => {
    const { service, prisma, routerApiService } = createService();
    prisma.router.findMany.mockResolvedValue([
      { id: "router-1", name: "Plateau" },
      { id: "router-2", name: "Cocody" },
    ]);
    routerApiService.getLiveStats
      .mockResolvedValueOnce({
        clients: [
          {
            id: "*1",
            username: "alpha",
            ipAddress: "10.10.10.2",
            macAddress: "AA:AA:AA:AA:AA:AA",
            uptime: "5m",
            bytesIn: 100,
            bytesOut: 500,
          },
          {
            id: "*2",
            username: "beta",
            ipAddress: "10.10.10.3",
            macAddress: "BB:BB:BB:BB:BB:BB",
            uptime: "10m",
            bytesIn: 1000,
            bytesOut: 250,
          },
        ],
      })
      .mockRejectedValueOnce(new Error("router timeout"));

    const result = await service.findActive();

    expect(result.totalRouters).toBe(2);
    expect(result.respondingRouters).toBe(1);
    expect(result.items.map((item) => item.username)).toEqual([
      "beta",
      "alpha",
    ]);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        routerId: "router-1",
        routerName: "Plateau",
        username: "beta",
      }),
    );
    expect(result.routerErrors).toEqual([
      {
        routerId: "router-2",
        routerName: "Cocody",
        error: "router timeout",
      },
    ]);
  });

  it("filters active sessions by router id when requested", async () => {
    const { service, prisma, routerApiService } = createService();
    prisma.router.findMany.mockResolvedValue([
      { id: "router-2", name: "Cocody" },
    ]);
    routerApiService.getLiveStats.mockResolvedValue({ clients: [] });

    await service.findActive("router-2");

    expect(prisma.router.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        id: "router-2",
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  });

  it("terminates a live session on the router and marks active local sessions as terminated", async () => {
    const { service, prisma, routerApiService } = createService();

    const result = await service.terminate("router-1", "*A0A0A22");

    expect(routerApiService.disconnectActiveSession).toHaveBeenCalledWith(
      "router-1",
      "*A0A0A22",
    );
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: {
        routerId: "router-1",
        mikrotikId: "*A0A0A22",
        status: SessionStatus.ACTIVE,
      },
      data: {
        status: SessionStatus.TERMINATED,
        terminatedAt: expect.any(Date),
        terminateReason: "manual_termination",
      },
    });
    expect(result).toEqual({ success: true });
  });
});
