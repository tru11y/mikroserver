import CircuitBreaker from "opossum";
import { RouterStatus, VoucherStatus } from "@prisma/client";
import { ServiceUnavailableException } from "@nestjs/common";
import type { HotspotUserConfig, RouterCredentials } from "./router-api.types";

interface RouterHotspotDeliveryPrisma {
  router: {
    findUniqueOrThrow: (args: {
      where: { id: string; deletedAt: null };
    }) => Promise<{
      id: string;
      name: string;
      wireguardIp: string | null;
      apiPort: number;
      apiUsername: string;
      apiPasswordHash: string;
    }>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  voucher: {
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
  };
}

interface RouterHotspotDeliveryDeps {
  prisma: RouterHotspotDeliveryPrisma;
  getOrCreateBreaker: (
    routerId: string,
  ) => CircuitBreaker<[RouterCredentials, HotspotUserConfig], void>;
  logger: {
    log: (message: string) => void;
    error: (message: string) => void;
  };
}

export async function pushHotspotUserToRouter(
  routerId: string,
  voucherId: string,
  config: HotspotUserConfig,
  deps: RouterHotspotDeliveryDeps,
): Promise<void> {
  const router = await deps.prisma.router.findUniqueOrThrow({
    where: { id: routerId, deletedAt: null },
  });

  if (!router.wireguardIp) {
    throw new Error(`Router ${router.name} has no WireGuard IP configured`);
  }

  const credentials: RouterCredentials = {
    id: router.id,
    wireguardIp: router.wireguardIp,
    apiPort: router.apiPort,
    apiUsername: router.apiUsername,
    apiPasswordHash: router.apiPasswordHash,
  };

  const breaker = deps.getOrCreateBreaker(routerId);

  try {
    await breaker.fire(credentials, config);

    await deps.prisma.voucher.update({
      where: { id: voucherId },
      data: {
        status: VoucherStatus.DELIVERED,
        deliveredAt: new Date(),
        routerId,
      },
    });

    await deps.prisma.router.update({
      where: { id: routerId },
      data: { lastSeenAt: new Date(), status: RouterStatus.ONLINE },
    });

    deps.logger.log(
      `Voucher ${voucherId} delivered to router ${router.name} (${router.wireguardIp})`,
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);

    await deps.prisma.voucher.update({
      where: { id: voucherId },
      data: {
        status: VoucherStatus.DELIVERY_FAILED,
        deliveryAttempts: { increment: 1 },
        lastDeliveryError: errMsg.slice(0, 1000),
      },
    });

    if (breaker.opened) {
      await deps.prisma.router.update({
        where: { id: routerId },
        data: { status: RouterStatus.OFFLINE },
      });
      deps.logger.error(
        `Circuit breaker OPEN for router ${router.name} — marking offline`,
      );
    }

    throw new ServiceUnavailableException(`Router delivery failed: ${errMsg}`);
  }
}
