import { Module, OnModuleInit, OnModuleDestroy, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUE_NAMES } from './queue.constants';
import { QueueService } from './queue.service';
import { VoucherDeliveryWorker } from './workers/voucher-delivery.worker';
import { WebhookProcessorWorker } from './workers/webhook-processor.worker';
import { getQueueToken } from './decorators/queue-token';
import { REDIS_CLIENT } from './decorators/inject-redis.decorator';
import { VouchersModule } from '../vouchers/vouchers.module';
import { RoutersModule } from '../routers/routers.module';

function createQueueProvider(name: string) {
  return {
    provide: getQueueToken(name),
    useFactory: (configService: ConfigService) => {
      const host = configService.get<string>('redis.host', 'localhost');
      const port = configService.get<number>('redis.port', 6379);
      const password = configService.get<string | undefined>('redis.password');
      return new Queue(name, {
        connection: { host, port, password },
        defaultJobOptions: { removeOnComplete: { count: 1000 }, removeOnFail: { count: 500 } },
      });
    },
    inject: [ConfigService],
  };
}

@Module({
  imports: [forwardRef(() => VouchersModule), RoutersModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService): Redis => {
        return new Redis({
          host: configService.get<string>('redis.host', 'localhost'),
          port: configService.get<number>('redis.port', 6379),
          password: configService.get<string | undefined>('redis.password'),
          db: configService.get<number>('redis.db', 0),
          lazyConnect: false,
          enableReadyCheck: true,
          maxRetriesPerRequest: null,
        });
      },
      inject: [ConfigService],
    },
    createQueueProvider(QUEUE_NAMES.VOUCHER_DELIVERY),
    createQueueProvider(QUEUE_NAMES.PAYMENT_WEBHOOK),
    QueueService,
    VoucherDeliveryWorker,
    WebhookProcessorWorker,
  ],
  exports: [QueueService, REDIS_CLIENT],
})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly configService: ConfigService,
    private readonly voucherWorker: VoucherDeliveryWorker,
    private readonly webhookWorker: WebhookProcessorWorker,
  ) {}

  onModuleInit() {
    const redisConfig = {
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string | undefined>('redis.password'),
    };
    this.voucherWorker.initialize(redisConfig);
    this.webhookWorker.initialize(redisConfig);
  }

  async onModuleDestroy() {
    await Promise.all([
      this.voucherWorker.shutdown(),
      this.webhookWorker.shutdown(),
    ]);
  }
}
