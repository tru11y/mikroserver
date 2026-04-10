import {
  GenerationType,
  PaymentProvider,
  Prisma,
  RouterStatus,
  SessionStatus,
  TransactionStatus,
  VoucherStatus,
} from "@prisma/client";
import { randomBytes } from "crypto";
import { addMinutes } from "date-fns";
import type { PrismaService } from "../prisma/prisma.service";
import { mergeRouterMetadata } from "./router-api.types";
import type {
  HotspotActiveClient,
  RouterSyncSummary,
} from "./router-api.types";

interface RouterHotspotSyncDeps {
  prisma: Pick<PrismaService, "router" | "session" | "voucher" | "transaction">;
  disconnectActiveSession: (
    routerId: string,
    mikrotikId: string,
  ) => Promise<void>;
  logger: {
    warn: (message: string) => void;
  };
}

export async function syncRouterHotspotActiveClients(
  deps: RouterHotspotSyncDeps,
  router: {
    id: string;
    metadata: Prisma.JsonValue | null;
  },
  rawClients: HotspotActiveClient[],
  fetchedAt = new Date(),
): Promise<RouterSyncSummary> {
  const usernames = Array.from(
    new Set(
      rawClients
        .map((client) => client.user?.trim())
        .filter((username): username is string => Boolean(username)),
    ),
  );

  const [vouchers, existingSessions] = await Promise.all([
    usernames.length > 0
      ? deps.prisma.voucher.findMany({
          where: {
            routerId: router.id,
            code: { in: usernames },
          },
          select: {
            id: true,
            code: true,
            status: true,
            activatedAt: true,
            expiresAt: true,
            generationType: true,
            transactionId: true,
            planId: true,
            plan: {
              select: {
                durationMinutes: true,
                priceXof: true,
                slug: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    deps.prisma.session.findMany({
      where: { routerId: router.id },
      include: {
        voucher: {
          select: { id: true, code: true },
        },
      },
    }),
  ]);

  const voucherByCode = new Map(
    vouchers.map((voucher) => [voucher.code, voucher]),
  );
  const sessionByVoucherId = new Map(
    existingSessions.map((session) => [session.voucherId, session]),
  );
  const activeVoucherIds = new Set<string>();
  const unmatchedUsers = new Set<string>();
  const vouchersToExpire = new Set<string>();
  const expiredManagedClientIds: string[] = [];
  let activatedVouchers = 0;

  for (const client of rawClients) {
    const username = client.user?.trim();
    if (!username) {
      continue;
    }

    const voucher = voucherByCode.get(username);
    if (!voucher) {
      unmatchedUsers.add(username);
      continue;
    }

    const expiredByTime = Boolean(
      voucher.expiresAt && voucher.expiresAt <= fetchedAt,
    );
    const expiredOrBlocked =
      voucher.status === VoucherStatus.REVOKED ||
      voucher.status === VoucherStatus.EXPIRED ||
      expiredByTime;

    if (expiredOrBlocked) {
      unmatchedUsers.add(username);

      if (expiredByTime && voucher.status !== VoucherStatus.EXPIRED) {
        vouchersToExpire.add(voucher.id);
      }

      if (client[".id"]) {
        expiredManagedClientIds.push(client[".id"]);
      }
      continue;
    }

    activeVoucherIds.add(voucher.id);
    const existingSession = sessionByVoucherId.get(voucher.id);
    const sessionData = {
      routerId: router.id,
      mikrotikId: client[".id"],
      macAddress: client["mac-address"],
      ipAddress: client.address,
      status: SessionStatus.ACTIVE,
      bytesIn: BigInt(parseInt(client["bytes-in"] || "0", 10)),
      bytesOut: BigInt(parseInt(client["bytes-out"] || "0", 10)),
      lastSeenAt: fetchedAt,
      terminatedAt: null,
      terminateReason: null,
    };

    if (existingSession) {
      await deps.prisma.session.update({
        where: { id: existingSession.id },
        data: {
          ...sessionData,
          startedAt:
            existingSession.status === SessionStatus.ACTIVE
              ? existingSession.startedAt
              : fetchedAt,
        },
      });
    } else {
      await deps.prisma.session.create({
        data: {
          voucherId: voucher.id,
          startedAt: fetchedAt,
          ...sessionData,
        },
      });
    }

    if (voucher.status !== VoucherStatus.ACTIVE) {
      const activationTime = voucher.activatedAt ?? fetchedAt;
      activatedVouchers += 1;

      // For MANUAL vouchers: create COMPLETED transaction at first activation (revenue at use-time)
      if (
        voucher.generationType === GenerationType.MANUAL &&
        !voucher.transactionId
      ) {
        const shortId = randomBytes(4).toString("hex").toUpperCase();
        const txRef = `MANUAL-ACT-${voucher.plan.slug.slice(0, 8).toUpperCase()}-${shortId}`;
        const idempotencyKey = `manual-activate-${voucher.id}`;
        const newTx = await deps.prisma.transaction.create({
          data: {
            reference: txRef,
            planId: voucher.planId,
            amountXof: voucher.plan.priceXof,
            status: TransactionStatus.COMPLETED,
            provider: PaymentProvider.MANUAL,
            paidAt: activationTime,
            expiresAt: activationTime,
            idempotencyKey,
            metadata: {
              source: "manual_voucher_activation",
              voucherId: voucher.id,
            },
          },
        });
        await deps.prisma.voucher.update({
          where: { id: voucher.id },
          data: { transactionId: newTx.id },
        });
      }

      await deps.prisma.voucher.update({
        where: { id: voucher.id },
        data: {
          status: VoucherStatus.ACTIVE,
          activatedAt: activationTime,
          expiresAt:
            voucher.expiresAt ??
            addMinutes(activationTime, voucher.plan.durationMinutes),
        },
      });
    } else if (!voucher.expiresAt) {
      const activationTime = voucher.activatedAt ?? fetchedAt;
      await deps.prisma.voucher.update({
        where: { id: voucher.id },
        data: {
          activatedAt: activationTime,
          expiresAt: addMinutes(activationTime, voucher.plan.durationMinutes),
        },
      });
    }
  }

  if (vouchersToExpire.size > 0) {
    await deps.prisma.voucher.updateMany({
      where: {
        id: { in: Array.from(vouchersToExpire) },
      },
      data: {
        status: VoucherStatus.EXPIRED,
      },
    });
  }

  let disconnectedExpiredSessions = 0;
  if (expiredManagedClientIds.length > 0) {
    for (const activeId of expiredManagedClientIds) {
      try {
        await deps.disconnectActiveSession(router.id, activeId);
        disconnectedExpiredSessions += 1;
      } catch (error) {
        deps.logger.warn(
          `Failed to disconnect expired active session ${activeId} on router ${router.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  const sessionsToDisconnect = existingSessions.filter(
    (session) =>
      session.status === SessionStatus.ACTIVE &&
      !activeVoucherIds.has(session.voucherId),
  );

  if (sessionsToDisconnect.length > 0) {
    await Promise.all(
      sessionsToDisconnect.map((session) =>
        deps.prisma.session.update({
          where: { id: session.id },
          data: {
            status: SessionStatus.DISCONNECTED,
            lastSeenAt: fetchedAt,
            terminatedAt: session.terminatedAt ?? fetchedAt,
            terminateReason: "sync_inactive",
          },
        }),
      ),
    );
  }

  const summary: RouterSyncSummary = {
    routerId: router.id,
    activeClients: rawClients.length,
    matchedVouchers: activeVoucherIds.size,
    activatedVouchers,
    disconnectedSessions:
      sessionsToDisconnect.length + disconnectedExpiredSessions,
    unmatchedUsers: Array.from(unmatchedUsers).sort(),
    fetchedAt,
  };

  await deps.prisma.router.update({
    where: { id: router.id },
    data: {
      status: RouterStatus.ONLINE,
      lastSeenAt: fetchedAt,
      metadata: mergeRouterMetadata(router.metadata, {
        lastSyncAt: fetchedAt.toISOString(),
        lastSyncError: null,
        lastActiveClients: summary.activeClients,
        lastMatchedVouchers: summary.matchedVouchers,
        lastActivatedVouchers: summary.activatedVouchers,
        lastDisconnectedSessions: summary.disconnectedSessions,
        lastUnmatchedUsers: summary.unmatchedUsers,
      }),
    },
  });

  return summary;
}
