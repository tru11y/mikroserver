import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { PaymentsModule } from '../payments/payments.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PaymentsModule, QueueModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
