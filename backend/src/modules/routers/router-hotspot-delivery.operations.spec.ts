import { RouterStatus, VoucherStatus } from "@prisma/client";
import { ServiceUnavailableException } from "@nestjs/common";
import { pushHotspotUserToRouter } from "./router-hotspot-delivery.operations";

describe("router hotspot delivery operations", () => {
  it("marks voucher delivered and router online after a successful push", async () => {
    const prisma = {
      router: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "router-1",
          name: "Router A",
          wireguardIp: "10.66.66.2",
          apiPort: 8728,
          apiUsername: "api",
          apiPasswordHash: "secret",
        }),
        update: jest.fn(),
      },
      voucher: {
        update: jest.fn(),
      },
    };
    const breaker = {
      fire: jest.fn().mockResolvedValue(undefined),
      opened: false,
    };
    const logger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    await pushHotspotUserToRouter(
      "router-1",
      "voucher-1",
      {
        username: "ticket-001",
        password: "pwd",
        profile: "7-Jours",
        comment: "ticket",
        limitUptime: "1d",
      },
      {
        prisma: prisma as never,
        getOrCreateBreaker: jest.fn(() => breaker as never),
        logger,
      },
    );

    expect(breaker.fire).toHaveBeenCalled();
    expect(prisma.voucher.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "voucher-1" },
        data: expect.objectContaining({
          status: VoucherStatus.DELIVERED,
          routerId: "router-1",
        }),
      }),
    );
    expect(prisma.router.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "router-1" },
        data: expect.objectContaining({
          status: RouterStatus.ONLINE,
        }),
      }),
    );
  });

  it("marks delivery failure and router offline when breaker is open", async () => {
    const prisma = {
      router: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "router-1",
          name: "Router A",
          wireguardIp: "10.66.66.2",
          apiPort: 8728,
          apiUsername: "api",
          apiPasswordHash: "secret",
        }),
        update: jest.fn(),
      },
      voucher: {
        update: jest.fn(),
      },
    };
    const breaker = {
      fire: jest.fn().mockRejectedValue(new Error("router timeout")),
      opened: true,
    };
    const logger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    await expect(
      pushHotspotUserToRouter(
        "router-1",
        "voucher-1",
        {
          username: "ticket-001",
          password: "pwd",
          profile: "7-Jours",
          comment: "ticket",
          limitUptime: "1d",
        },
        {
          prisma: prisma as never,
          getOrCreateBreaker: jest.fn(() => breaker as never),
          logger,
        },
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.voucher.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "voucher-1" },
        data: expect.objectContaining({
          status: VoucherStatus.DELIVERY_FAILED,
        }),
      }),
    );
    expect(prisma.router.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "router-1" },
        data: expect.objectContaining({
          status: RouterStatus.OFFLINE,
        }),
      }),
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
