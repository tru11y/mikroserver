import { RouterStatus } from "@prisma/client";
import { checkRouterHealthStatus } from "./router-health.operations";

describe("router health operations", () => {
  it("marks a router online after a successful identity check", async () => {
    const prisma = {
      router: {
        update: jest.fn(),
      },
    };

    const result = await checkRouterHealthStatus(
      {
        id: "router-1",
        status: RouterStatus.ONLINE,
        wireguardIp: "10.66.66.2",
        apiPort: 8728,
        apiUsername: "api",
        apiPasswordHash: "secret",
        metadata: null,
      },
      {
        prisma: prisma as never,
        mikroNode: { getConnection: jest.fn(), parseItems: jest.fn() } as never,
        timeoutMs: 10000,
        runIdentityCheck: jest.fn().mockResolvedValue(undefined),
      },
    );

    expect(result).toEqual({ online: true, newStatus: RouterStatus.ONLINE });
    expect(prisma.router.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "router-1" },
        data: expect.objectContaining({
          status: RouterStatus.ONLINE,
        }),
      }),
    );
  });

  it("marks a router offline when the identity check fails", async () => {
    const prisma = {
      router: {
        update: jest.fn(),
      },
    };

    const result = await checkRouterHealthStatus(
      {
        id: "router-1",
        status: RouterStatus.ONLINE,
        wireguardIp: "10.66.66.2",
        apiPort: 8728,
        apiUsername: "api",
        apiPasswordHash: "secret",
        // Already at 1 failure — next failure hits threshold (2) and flips OFFLINE
        metadata: { consecutiveHealthFailures: 1 },
      },
      {
        prisma: prisma as never,
        mikroNode: { getConnection: jest.fn(), parseItems: jest.fn() } as never,
        timeoutMs: 10000,
        runIdentityCheck: jest
          .fn()
          .mockRejectedValue(new Error("Socket Timeout")),
      },
    );

    expect(result).toEqual({
      online: false,
      newStatus: RouterStatus.OFFLINE,
      error: "Socket Timeout",
    });
    expect(prisma.router.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "router-1" },
        data: expect.objectContaining({
          status: RouterStatus.OFFLINE,
        }),
      }),
    );
  });
});
