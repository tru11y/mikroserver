import { Module } from "@nestjs/common";
import { InsightsService } from "./insights.service";
import { InsightsController } from "./insights.controller";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  providers: [InsightsService],
  controllers: [InsightsController],
  exports: [InsightsService],
})
export class InsightsModule {}
