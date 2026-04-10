import { Module, forwardRef } from "@nestjs/common";
import { SpeedBoostsService } from "./speed-boosts.service";
import { SpeedBoostsController } from "./speed-boosts.controller";
import { RoutersModule } from "../routers/routers.module";
import { PaymentsModule } from "../payments/payments.module";
import { QueueModule } from "../queue/queue.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    RoutersModule,
    PaymentsModule,
    NotificationsModule,
    forwardRef(() => QueueModule),
  ],
  providers: [SpeedBoostsService],
  controllers: [SpeedBoostsController],
  exports: [SpeedBoostsService],
})
export class SpeedBoostsModule {}
