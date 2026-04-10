import { Injectable, Logger, Optional } from "@nestjs/common";
import { Worker, Job } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { VoucherService } from "../../vouchers/voucher.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { ResellersService } from "../../resellers/resellers.service";
import { SpeedBoostsService } from "../../speed-boosts/speed-boosts.service";
import { JOB_NAMES, QUEUE_NAMES } from "../queue.constants";
import { WebhookProcessJobData } from "../queue.service";
import {
  TransactionStatus,
  WebhookEventStatus,
  NotificationType,
} from "@prisma/client";

/**
 * Webhook Processor Worker
 *
 * ARCHITECTURAL DECISIONS:
 * 1. Webhook receipt and processing are DECOUPLED:
 *    - Webhook controller stores raw event immediately (< 5ms)
 *    - This worker processes it asynchronously (1-2s for voucher generation)
 *    - Wave's webhook timeout is satisfied; customer gets instant response
 * 2. Idempotency: job ID = "webhook-{eventId}" + DB check prevent double-processing
 * 3. Full transaction: payment update + voucher creation in one Prisma transaction
 */

@Injectable()
export class WebhookProcessorWorker {
  private readonly logger = new Logger(WebhookProcessorWorker.name);
  private worker: Worker | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly voucherService: VoucherService,
    private readonly configService: ConfigService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly resellersService?: ResellersService,
    @Optional() private readonly speedBoostsService?: SpeedBoostsService,
  ) {}

  initialize(redisConnection: {
    host: string;
    port: number;
    password?: string;
  }): void {
    this.worker = new Worker(
      QUEUE_NAMES.PAYMENT_WEBHOOK,
      async (job: Job<WebhookProcessJobData>) => {
        await this.processJob(job);
      },
      {
        connection: redisConnection,
        concurrency: 10, // Higher concurrency for webhooks
        autorun: true,
      },
    );

    this.worker.on("completed", (job) => {
      this.logger.log(
        `Webhook processed: job=${job.id} event=${job.data.webhookEventId}`,
      );
    });

    this.worker.on("failed", (job, err) => {
      const isPermanent =
        job?.opts?.attempts !== undefined &&
        (job.attemptsMade ?? 0) >= job.opts.attempts;

      if (isPermanent) {
        this.logger.error(
          `[DLQ] Webhook processing PERMANENTLY FAILED — payment may be lost. ` +
            `job=${job?.id} event=${job?.data.webhookEventId} provider=${job?.data.provider} err=${err.message}`,
        );
      } else {
        this.logger.error(
          `Webhook processing failed (will retry): event=${job?.data.webhookEventId} err=${err.message}`,
        );
      }
    });

    this.logger.log("Webhook processor worker initialized");
  }

  async shutdown(): Promise<void> {
    await this.worker?.close();
  }

  /**
   * Normalize raw webhook payload to a provider-agnostic structure.
   * Wave embeds its data under a `data` key; CinetPay uses flat `cpm_*` fields.
   */
  private extractEventFields(
    payload: Record<string, unknown>,
    provider: string,
  ): {
    clientReference: string | undefined;
    paymentStatus: "succeeded" | "failed" | "expired" | "unknown";
    externalId: string | undefined;
    paidAt: Date | undefined;
    failureReason: string | undefined;
  } {
    if (provider === "CINETPAY") {
      const cpmTransId = payload["cpm_trans_id"] as string | undefined;
      const cpmStatus = payload["cpm_trans_status"] as string | undefined;
      const payDate = payload["cpm_payment_date"] as string | undefined;
      const payTime = payload["cpm_payment_time"] as string | undefined;

      let paymentStatus: "succeeded" | "failed" | "expired" | "unknown";
      if (cpmStatus === "ACCEPTED") paymentStatus = "succeeded";
      else if (cpmStatus === "REFUSED" || cpmStatus === "CANCELLED")
        paymentStatus = "failed";
      else if (cpmStatus === "EXPIRED") paymentStatus = "expired";
      else paymentStatus = "unknown";

      let paidAt: Date | undefined;
      if (payDate && payTime && paymentStatus === "succeeded") {
        try {
          paidAt = new Date(`${payDate} ${payTime}`);
        } catch {
          paidAt = new Date();
        }
      }

      return {
        clientReference: cpmTransId,
        paymentStatus,
        externalId: cpmTransId,
        paidAt,
        failureReason: payload["cpm_error_message"] as string | undefined,
      };
    }

    // Wave (default)
    const waveData = (payload["data"] as Record<string, unknown>) ?? payload;
    const waveStatus = waveData["payment_status"] as string | undefined;

    let paymentStatus: "succeeded" | "failed" | "expired" | "unknown";
    if (waveStatus === "succeeded") paymentStatus = "succeeded";
    else if (waveStatus === "failed") paymentStatus = "failed";
    else if (waveStatus === "expired") paymentStatus = "expired";
    else paymentStatus = "unknown";

    const whenCompleted = waveData["when_completed"] as string | undefined;

    return {
      clientReference: waveData["client_reference"] as string | undefined,
      paymentStatus,
      externalId: waveData["id"] as string | undefined,
      paidAt: whenCompleted ? new Date(whenCompleted) : new Date(),
      failureReason: waveData["error_message"] as string | undefined,
    };
  }

  private async processJob(job: Job<WebhookProcessJobData>): Promise<void> {
    if (job.name !== JOB_NAMES.PROCESS_WEBHOOK) return;

    const { webhookEventId } = job.data;

    const event = await this.prisma.webhookEvent.findUnique({
      where: { id: webhookEventId },
    });

    if (!event) {
      // Throw instead of returning: DB may not have committed yet (race condition).
      // BullMQ will retry up to the configured attempt limit.
      throw new Error(`Webhook event ${webhookEventId} not found — will retry`);
    }

    // Idempotency: already processed
    if (event.status === WebhookEventStatus.PROCESSED) {
      this.logger.log(`Webhook event ${webhookEventId} already processed`);
      return;
    }

    // Mark as processing
    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { status: WebhookEventStatus.PROCESSING },
    });

    try {
      const payload = event.rawPayload as Record<string, unknown>;
      const {
        clientReference,
        paymentStatus,
        externalId,
        paidAt,
        failureReason,
      } = this.extractEventFields(payload, event.provider);

      if (!clientReference || !/^MS-[A-Z0-9]{12}$/.test(clientReference)) {
        this.logger.warn(
          `Webhook ${webhookEventId} invalid client_reference: "${clientReference}"`,
        );
        await this.markEventFailed(
          webhookEventId,
          `Invalid client_reference: ${clientReference ?? "missing"}`,
        );
        return;
      }

      // Find the transaction
      const transaction = await this.prisma.transaction.findUnique({
        where: { reference: clientReference },
        include: { plan: true, boostTier: true },
      });

      if (!transaction) {
        this.logger.warn(
          `Transaction not found for reference: ${clientReference}`,
        );
        await this.markEventFailed(
          webhookEventId,
          `Transaction not found: ${clientReference}`,
        );
        return;
      }

      // Link event to transaction
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { transactionId: transaction.id },
      });

      // Handle payment success
      if (paymentStatus === "succeeded") {
        if (transaction.status === TransactionStatus.COMPLETED) {
          this.logger.log(
            `Transaction ${transaction.id} already completed — idempotent`,
          );
          await this.markEventProcessed(webhookEventId);
          return;
        }

        // Atomic: update transaction + link webhook event
        await this.prisma.$transaction([
          this.prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: TransactionStatus.COMPLETED,
              externalReference: externalId,
              paidAt: paidAt ?? new Date(),
            },
          }),
          this.prisma.webhookEvent.update({
            where: { id: webhookEventId },
            data: {
              status: WebhookEventStatus.PROCESSED,
              processedAt: new Date(),
            },
          }),
        ]);

        if (transaction.boostTierId && this.speedBoostsService) {
          // --- Speed Boost payment ---
          await this.speedBoostsService.activateBoost(transaction.id);
        } else if (transaction.planId) {
          // --- Regular voucher payment ---
          await this.voucherService.generateForTransaction(
            transaction.id,
            transaction.planId,
          );

          // Credit reseller commission if voucher was reseller-generated
          if (this.resellersService) {
            const voucher = await this.prisma.voucher.findFirst({
              where: { transactionId: transaction.id },
              select: {
                createdById: true,
                plan: { select: { priceXof: true } },
              },
            });
            if (voucher?.createdById) {
              const resellerConfig =
                await this.prisma.resellerConfig.findUnique({
                  where: { userId: voucher.createdById },
                  select: { id: true },
                });
              if (resellerConfig) {
                await this.resellersService
                  .recordSale(resellerConfig.id, voucher.plan?.priceXof ?? 0)
                  .catch(() => {});
              }
            }
          }

          // Notify router owner about payment received
          if (this.notificationsService) {
            const voucher = await this.prisma.voucher.findFirst({
              where: { transactionId: transaction.id },
              include: { router: { select: { id: true } } },
            });

            if (voucher?.router?.id) {
              await this.notificationsService
                .notifyRouterOwner(voucher.router.id, {
                  type: NotificationType.PAYMENT_RECEIVED,
                  title: "Paiement reçu",
                  body: `Paiement de ${transaction.amountXof} FCFA reçu · Plan ${transaction.plan?.name ?? "Inconnu"}`,
                  data: {
                    transactionId: transaction.id,
                    amountXof: transaction.amountXof,
                    planName: transaction.plan?.name,
                  },
                  routerId: voucher.router.id,
                })
                .catch(() => {});
            }
          }
        }

        this.logger.log(
          `Payment SUCCESS: tx=${transaction.id} ref=${clientReference}`,
        );
      } else if (paymentStatus === "failed" || paymentStatus === "expired") {
        await this.prisma.$transaction([
          this.prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status:
                paymentStatus === "expired"
                  ? TransactionStatus.EXPIRED
                  : TransactionStatus.FAILED,
              failedAt: new Date(),
              failureReason: failureReason ?? paymentStatus,
            },
          }),
          this.prisma.webhookEvent.update({
            where: { id: webhookEventId },
            data: {
              status: WebhookEventStatus.PROCESSED,
              processedAt: new Date(),
            },
          }),
        ]);

        this.logger.log(
          `Payment ${paymentStatus.toUpperCase()}: tx=${transaction.id}`,
        );
      } else {
        // Unknown status — mark processed to avoid infinite retry
        await this.markEventProcessed(webhookEventId);
        this.logger.warn(
          `Unknown payment status "${paymentStatus}" for event ${webhookEventId}`,
        );
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await this.markEventFailed(webhookEventId, errMsg);
      throw error; // Re-throw for BullMQ retry
    }
  }

  private async markEventProcessed(eventId: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: WebhookEventStatus.PROCESSED, processedAt: new Date() },
    });
  }

  private async markEventFailed(
    eventId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: WebhookEventStatus.FAILED,
        failureReason: reason.slice(0, 1000),
        retryCount: { increment: 1 },
      },
    });
  }
}
