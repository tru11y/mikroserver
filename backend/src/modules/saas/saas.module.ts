import { Module, OnModuleInit, Logger } from "@nestjs/common";
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
export class SaasModule implements OnModuleInit {
  private readonly logger = new Logger(SaasModule.name);

  constructor(private readonly saasService: SaasService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.saasService.seedTiers();
    } catch (error) {
      this.logger.error(
        `Failed to seed SaaS tiers: ${(error as Error).message}`,
      );
    }
  }
}
