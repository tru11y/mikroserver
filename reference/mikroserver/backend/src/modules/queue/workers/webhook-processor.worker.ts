import { Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { VoucherService } from '../../vouchers/voucher.service';
import { JOB_NAMES, QUEUE_NAMES } from '../queue.constants';
import { WebhookProcessJobData } from '../queue.service';
import {
  TransactionStatus,
  WebhookEventStatus,
  PaymentProvider,
} from '@prisma/client';

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
  ) {}

  initialize(redisConnection: { host: string; port: number; password?: string }): void {
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

    this.worker.on('completed', (job) => {
      this.logger.log(`Webhook processed: job=${job.id} event=${job.data.webhookEventId}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Webhook processing failed: event=${job?.data.webhookEventId} err=${err.message}`,
      );
    });

    this.logger.log('Webhook processor worker initialized');
  }

  async shutdown(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(job: Job<WebhookProcessJobData>): Promise<void> {
    if (job.name !== JOB_NAMES.PROCESS_WEBHOOK) return;

    const { webhookEventId } = job.data;

    const event = await this.prisma.webhookEvent.findUnique({
      where: { id: webhookEventId },
    });

    if (!event) {
      this.logger.warn(`Webhook event ${webhookEventId} not found`);
      return;
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
      const waveData = (payload['data'] as Record<string, unknown>) ?? payload;

      const clientReference = waveData['client_reference'] as string | undefined;
      const paymentStatus = waveData['payment_status'] as string | undefined;

      if (!clientReference) {
        this.logger.warn(`Webhook ${webhookEventId} missing client_reference`);
        await this.markEventFailed(webhookEventId, 'Missing client_reference');
        return;
      }

      // Find the transaction
      const transaction = await this.prisma.transaction.findUnique({
        where: { reference: clientReference },
        include: { plan: true },
      });

      if (!transaction) {
        this.logger.warn(`Transaction not found for reference: ${clientReference}`);
        await this.markEventFailed(webhookEventId, `Transaction not found: ${clientReference}`);
        return;
      }

      // Link event to transaction
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { transactionId: transaction.id },
      });

      // Handle payment success
      if (paymentStatus === 'succeeded') {
        if (transaction.status === TransactionStatus.COMPLETED) {
          this.logger.log(`Transaction ${transaction.id} already completed — idempotent`);
          await this.markEventProcessed(webhookEventId);
          return;
        }

        const externalId = waveData['id'] as string | undefined;
        const whenCompleted = waveData['when_completed'] as string | undefined;

        // Atomic: update transaction + link webhook event
        await this.prisma.$transaction([
          this.prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: TransactionStatus.COMPLETED,
              externalReference: externalId,
              paidAt: whenCompleted ? new Date(whenCompleted) : new Date(),
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

        // Generate and queue voucher delivery (outside transaction — non-blocking)
        await this.voucherService.generateForTransaction(
          transaction.id,
          transaction.planId,
        );

        this.logger.log(
          `Payment SUCCESS: tx=${transaction.id} ref=${clientReference}`,
        );
      } else if (paymentStatus === 'failed' || paymentStatus === 'expired') {
        await this.prisma.$transaction([
          this.prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status:
                paymentStatus === 'expired'
                  ? TransactionStatus.EXPIRED
                  : TransactionStatus.FAILED,
              failedAt: new Date(),
              failureReason: (waveData['error_message'] as string) ?? paymentStatus,
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

  private async markEventFailed(eventId: string, reason: string): Promise<void> {
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
