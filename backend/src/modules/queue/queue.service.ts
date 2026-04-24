import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { InjectQueue } from "./decorators/inject-queue.decorator";
import { QUEUE_NAMES, JOB_NAMES } from "./queue.constants";
import { ConfigService } from "@nestjs/config";
import type { RouterProvisionJobData } from "./workers/router-provisioning.worker";

export interface VoucherDeliveryJobData {
  voucherId: string;
  routerId?: string;
}

export interface WebhookProcessJobData {
  webhookEventId: string;
  provider: string;
}

export type { RouterProvisionJobData };

export interface BoostRevertJobData {
  boostId: string;
}

export interface QueueHealthSnapshot {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  paused: number;
}

export interface OperationalQueueStats {
  voucherDelivery: QueueHealthSnapshot;
  paymentWebhook: QueueHealthSnapshot;
  speedBoost: QueueHealthSnapshot;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly maxAttempts: number;
  private readonly backoffMs: number;

  constructor(
    @InjectQueue(QUEUE_NAMES.VOUCHER_DELIVERY)
    private readonly voucherDeliveryQueue: Queue,

    @InjectQueue(QUEUE_NAMES.PAYMENT_WEBHOOK)
    private readonly webhookQueue: Queue,

    @InjectQueue(QUEUE_NAMES.SPEED_BOOST)
    private readonly speedBoostQueue: Queue,

    @InjectQueue(QUEUE_NAMES.ROUTER_PROVISION)
    private readonly routerProvisionQueue: Queue,

    private readonly configService: ConfigService,
  ) {
    this.maxAttempts = this.configService.get<number>(
      "queue.voucherDeliveryAttempts",
      5,
    );
    this.backoffMs = this.configService.get<number>(
      "queue.voucherDeliveryBackoffMs",
      5000,
    );
  }

  async enqueueVoucherDelivery(data: VoucherDeliveryJobData): Promise<void> {
    await this.voucherDeliveryQueue.add(JOB_NAMES.DELIVER_VOUCHER, data, {
      attempts: this.maxAttempts,
      backoff: {
        type: "exponential",
        delay: this.backoffMs,
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
      jobId: `voucher-${data.voucherId}`, // Prevent duplicate jobs
    });

    this.logger.log(`Enqueued voucher delivery for ${data.voucherId}`);
  }

  async enqueueWebhookProcessing(data: WebhookProcessJobData): Promise<void> {
    await this.webhookQueue.add(JOB_NAMES.PROCESS_WEBHOOK, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 5000 },
      removeOnFail: { count: 1000 },
      jobId: `webhook-${data.webhookEventId}`, // Idempotent
    });

    this.logger.log(
      `Enqueued webhook processing for event ${data.webhookEventId}`,
    );
  }

  async enqueueRouterProvision(data: RouterProvisionJobData): Promise<void> {
    await this.routerProvisionQueue.add(JOB_NAMES.PROVISION_ROUTER, data, {
      // One active job per router — BullMQ silently ignores if jobId exists
      jobId: `provision-${data.routerId}`,
      // Single attempt: failure = rollback.  No blind retry of failed tunnel polls.
      attempts: 1,
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
    });
    this.logger.log(
      `[Provision] Enqueued ${data.safeOnboard ? "safe-onboard" : "poll-only"} job ` +
        `for router ${data.routerId} (wgIp=${data.wgIp})`,
    );
  }

  async enqueueBoostRevert(
    data: BoostRevertJobData,
    delayMs: number,
  ): Promise<void> {
    await this.speedBoostQueue.add(JOB_NAMES.REVERT_BOOST, data, {
      delay: delayMs,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
      jobId: `boost-revert-${data.boostId}`,
    });

    this.logger.log(
      `Scheduled boost revert for ${data.boostId} in ${Math.round(delayMs / 60000)} min`,
    );
  }

  async getOperationalStats(): Promise<OperationalQueueStats> {
    const [voucherDelivery, paymentWebhook, speedBoost] = await Promise.all([
      this.getQueueSnapshot(
        this.voucherDeliveryQueue,
        QUEUE_NAMES.VOUCHER_DELIVERY,
      ),
      this.getQueueSnapshot(this.webhookQueue, QUEUE_NAMES.PAYMENT_WEBHOOK),
      this.getQueueSnapshot(this.speedBoostQueue, QUEUE_NAMES.SPEED_BOOST),
    ]);

    return {
      voucherDelivery,
      paymentWebhook,
      speedBoost,
    };
  }

  private async getQueueSnapshot(
    queue: Queue,
    queueName: string,
  ): Promise<QueueHealthSnapshot> {
    try {
      const counts = await queue.getJobCounts(
        "waiting",
        "active",
        "delayed",
        "failed",
        "paused",
      );

      return {
        waiting: counts["waiting"] ?? 0,
        active: counts["active"] ?? 0,
        delayed: counts["delayed"] ?? 0,
        failed: counts["failed"] ?? 0,
        paused: counts["paused"] ?? 0,
      };
    } catch (error) {
      this.logger.warn(
        `Unable to read queue health for ${queueName}: ${String(error)}`,
      );

      return {
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        paused: 0,
      };
    }
  }
}
