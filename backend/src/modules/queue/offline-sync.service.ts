import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { QueueService } from "./queue.service";
import { VoucherStatus, RouterStatus } from "@prisma/client";

/**
 * OfflineSyncService
 *
 * Periodically flushes vouchers stuck in PENDING_OFFLINE status.
 * A voucher enters PENDING_OFFLINE when the delivery worker detects the
 * target router is unreachable (circuit open, timeout, connection refused).
 *
 * Every 2 minutes, this service checks for PENDING_OFFLINE vouchers whose
 * router is now ONLINE and re-enqueues them for delivery.
 */
@Injectable()
export class OfflineSyncService {
  private readonly logger = new Logger(OfflineSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  @Cron("0 */2 * * * *") // Every 2 minutes
  async flushPendingOfflineVouchers(): Promise<void> {
    const pending = await this.prisma.voucher.findMany({
      where: {
        status: VoucherStatus.PENDING_OFFLINE,
        router: { status: RouterStatus.ONLINE },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true, routerId: true },
      take: 100,
    });

    if (pending.length === 0) return;

    this.logger.log(
      `[OfflineSync] Flushing ${pending.length} PENDING_OFFLINE voucher(s)`,
    );

    let flushed = 0;
    for (const voucher of pending) {
      try {
        // Reset to GENERATED so the worker can process it fresh
        await this.prisma.voucher.update({
          where: { id: voucher.id },
          data: { status: VoucherStatus.GENERATED },
        });

        await this.queueService.enqueueVoucherDelivery({
          voucherId: voucher.id,
          routerId: voucher.routerId ?? undefined,
        });

        flushed++;
      } catch (error) {
        this.logger.error(
          `[OfflineSync] Failed to re-enqueue voucher ${voucher.id}: ${String(error)}`,
        );
      }
    }

    this.logger.log(
      `[OfflineSync] Flushed ${flushed}/${pending.length} voucher(s)`,
    );
  }
}
