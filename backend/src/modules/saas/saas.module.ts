import { Module } from "@nestjs/common";
import { SaasService } from "./saas.service";
import { SaasController } from "./saas.controller";
import { SaasTierGuard } from "./saas-tier.guard";
import { SubscriptionActiveGuard } from "./subscription-active.guard";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  providers: [SaasService, SaasTierGuard, SubscriptionActiveGuard],
  controllers: [SaasController],
  exports: [SaasService, SaasTierGuard, SubscriptionActiveGuard],
})
export class SaasModule {}
