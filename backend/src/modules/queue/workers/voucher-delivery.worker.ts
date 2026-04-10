import { Injectable, Logger } from "@nestjs/common";
import { Worker, Job } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { RouterApiService } from "../../routers/router-api.service";
import { JOB_NAMES, QUEUE_NAMES } from "../queue.constants";
import { VoucherDeliveryJobData } from "../queue.service";
import { VoucherStatus } from "@prisma/client";

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

  initialize(redisConnection: {
    host: string;
    port: number;
    password?: string;
  }): void {
    const concurrency = this.configService.get<number>("queue.concurrency", 5);

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

    this.worker.on("completed", (job) => {
      this.logger.log(
        `Voucher delivery completed: job=${job.id} voucher=${job.data.voucherId}`,
      );
    });

    this.worker.on("failed", (job, err) => {
      const isPermanent =
        job?.opts?.attempts !== undefined &&
        (job.attemptsMade ?? 0) >= job.opts.attempts;

      if (isPermanent) {
        // CRITICAL: no more retries — operator must investigate manually.
        // Connect an alerting channel here (Slack/email/PagerDuty).
        this.logger.error(
          `[DLQ] Voucher delivery PERMANENTLY FAILED — manual action required. ` +
            `job=${job?.id} voucher=${job?.data.voucherId} err=${err.message}`,
        );
      } else {
        this.logger.error(
          `Voucher delivery failed (will retry): job=${job?.id} voucher=${job?.data.voucherId} err=${err.message}`,
        );
      }
    });

    this.logger.log("Voucher delivery worker initialized");
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
      throw new Error("No router assigned to voucher");
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

    try {
      await this.routerApiService.pushHotspotUser(
        targetRouterId,
        voucherId,
        config,
      );
    } catch (error) {
      // If router is offline/circuit open, park the voucher instead of burning retries
      if (this.isRouterOfflineError(error)) {
        await this.prisma.voucher.update({
          where: { id: voucherId },
          data: {
            status: VoucherStatus.PENDING_OFFLINE,
            lastDeliveryError: this.extractErrorMessage(error),
            deliveryAttempts: { increment: 1 },
          },
        });
        this.logger.warn(
          `Voucher ${voucherId} parked as PENDING_OFFLINE — router ${targetRouterId} unreachable`,
        );
        return; // Do NOT throw — prevents BullMQ from retrying
      }
      throw error; // Config/data errors → let BullMQ retry normally
    }
  }

  private isRouterOfflineError(error: unknown): boolean {
    const msg = (
      error instanceof Error ? error.message : String(error)
    ).toLowerCase();
    return (
      msg.includes("breaker is open") ||
      msg.includes("circuit open") ||
      msg.includes("timeout") ||
      msg.includes("econnrefused") ||
      msg.includes("hors ligne") ||
      msg.includes("service unavailable") ||
      (typeof error === "object" &&
        error !== null &&
        "status" in error &&
        ((error as Record<string, unknown>)["status"] === 503 ||
          (error as Record<string, unknown>)["status"] === 504))
    );
  }

  private extractErrorMessage(error: unknown): string {
    return (error instanceof Error ? error.message : String(error)).slice(
      0,
      500,
    );
  }

  private minutesToRouterOsUptime(minutes: number): string {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    const timePart = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
    return days > 0 ? `${days}d ${timePart}` : timePart || "00:01:00";
  }
}
