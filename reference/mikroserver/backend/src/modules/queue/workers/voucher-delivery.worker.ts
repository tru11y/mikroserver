import { Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RouterApiService } from '../../routers/router-api.service';
import { JOB_NAMES, QUEUE_NAMES } from '../queue.constants';
import { VoucherDeliveryJobData } from '../queue.service';
import { VoucherStatus } from '@prisma/client';
import { addMinutes } from 'date-fns';

/**
 * Voucher Delivery Worker
 *
 * ARCHITECTURAL DECISIONS:
 * 1. Runs in a separate process context — non-blocking for API
 * 2. Exponential backoff retry prevents overwhelming offline routers
 * 3. Idempotency: job ID = "voucher-{voucherId}" prevents duplicate deliveries
 * 4. Uptime limit computed from plan duration at delivery time
 * 5. Circuit breaker in RouterApiService handles persistent failures
 */

@Injectable()
export class VoucherDeliveryWorker {
  private readonly logger = new Logger(VoucherDeliveryWorker.name);
  private worker: Worker | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly routerApiService: RouterApiService,
    private readonly configService: ConfigService,
  ) {}

  initialize(redisConnection: { host: string; port: number; password?: string }): void {
    const concurrency = this.configService.get<number>('queue.concurrency', 5);

    this.worker = new Worker(
      QUEUE_NAMES.VOUCHER_DELIVERY,
      async (job: Job<VoucherDeliveryJobData>) => {
        await this.processJob(job);
      },
      {
        connection: redisConnection,
        concurrency,
        autorun: true,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(
        `Voucher delivery completed: job=${job.id} voucher=${job.data.voucherId}`,
      );
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Voucher delivery failed: job=${job?.id} voucher=${job?.data.voucherId} err=${err.message}`,
      );
    });

    this.logger.log('Voucher delivery worker initialized');
  }

  async shutdown(): Promise<void> {
    await this.worker?.close();
  }

  // ---------------------------------------------------------------------------
  // Job processing
  // ---------------------------------------------------------------------------

  private async processJob(job: Job<VoucherDeliveryJobData>): Promise<void> {
    const { voucherId, routerId } = job.data;

    if (job.name !== JOB_NAMES.DELIVER_VOUCHER) {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return;
    }

    // Fetch voucher with plan and router
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
      include: { plan: true, router: true },
    });

    if (!voucher) {
      this.logger.warn(`Voucher ${voucherId} not found — skipping`);
      return;
    }

    // Already delivered — idempotency
    if (voucher.status === VoucherStatus.DELIVERED) {
      this.logger.log(`Voucher ${voucherId} already delivered — skipping`);
      return;
    }

    // Voucher expired before delivery — mark failed
    if (voucher.expiresAt && voucher.expiresAt < new Date()) {
      await this.prisma.voucher.update({
        where: { id: voucherId },
        data: { status: VoucherStatus.EXPIRED },
      });
      this.logger.warn(`Voucher ${voucherId} expired before delivery`);
      return;
    }

    const targetRouterId = routerId ?? voucher.routerId;

    if (!targetRouterId) {
      this.logger.warn(
        `No router assigned for voucher ${voucherId} — will retry when router is set`,
      );
      throw new Error('No router assigned to voucher');
    }

    // Compute uptime limit for RouterOS
    const uptimeLimit = this.minutesToRouterOsUptime(
      voucher.plan.durationMinutes,
    );

    const config = {
      username: voucher.code,
      password: voucher.passwordPlain,
      profile: voucher.plan.userProfile,
      comment: voucher.mikrotikComment ?? `MS-${voucherId.slice(0, 8)}`,
      limitUptime: uptimeLimit,
      limitBytesIn: voucher.plan.dataLimitMb
        ? String(voucher.plan.dataLimitMb * 1024 * 1024)
        : undefined,
      limitBytesOut: undefined,
    };

    await this.routerApiService.pushHotspotUser(
      targetRouterId,
      voucherId,
      config,
    );
  }

  private minutesToRouterOsUptime(minutes: number): string {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`);
    else parts.push(`${String(mins).padStart(2, '0')}:00`);

    return parts.join('') || '01:00:00';
  }
}
