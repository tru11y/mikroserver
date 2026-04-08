import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from './decorators/inject-queue.decorator';
import { QUEUE_NAMES, JOB_NAMES } from './queue.constants';
import { ConfigService } from '@nestjs/config';

export interface VoucherDeliveryJobData {
  voucherId: string;
  routerId?: string;
}

export interface WebhookProcessJobData {
  webhookEventId: string;
  provider: string;
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

    private readonly configService: ConfigService,
  ) {
    this.maxAttempts = this.configService.get<number>(
      'queue.voucherDeliveryAttempts',
      5,
    );
    this.backoffMs = this.configService.get<number>(
      'queue.voucherDeliveryBackoffMs',
      5000,
    );
  }

  async enqueueVoucherDelivery(data: VoucherDeliveryJobData): Promise<void> {
    await this.voucherDeliveryQueue.add(JOB_NAMES.DELIVER_VOUCHER, data, {
      attempts: this.maxAttempts,
      backoff: {
        type: 'exponential',
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
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 5000 },
      removeOnFail: { count: 1000 },
      jobId: `webhook-${data.webhookEventId}`, // Idempotent
    });

    this.logger.log(
      `Enqueued webhook processing for event ${data.webhookEventId}`,
    );
  }
}
