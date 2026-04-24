import { Module, OnModuleInit, Logger, forwardRef } from "@nestjs/common";
import { RoutersService } from "./routers.service";
import { RoutersController } from "./routers.controller";
import { RouterApiService } from "./router-api.service";
import { RouterAccessService } from "./router-access.service";
import { RouterAccessController } from "./router-access.controller";
import { PortMappingService } from "./port-mapping.service";
import {
  PortMappingController,
  AdminPortMappingController,
} from "./port-mapping.controller";
import { CredentialsService } from "./credentials.service";
import { WgIpPoolService } from "./wg-ip-pool.service";
import { RouterSafeOnboardingService } from "./router-safe-onboarding.service";
import { AuditModule } from "../audit/audit.module";
import { SaasModule } from "../saas/saas.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { QueueModule } from "../queue/queue.module";

@Module({
  imports: [
    AuditModule,
    SaasModule,
    NotificationsModule,
    forwardRef(() => QueueModule),
  ],
  providers: [
    RoutersService,
    RouterApiService,
    RouterAccessService,
    PortMappingService,
    CredentialsService,
    WgIpPoolService,
    RouterSafeOnboardingService,
  ],
  controllers: [
    RoutersController,
    RouterAccessController,
    PortMappingController,
    AdminPortMappingController,
  ],
  exports: [
    RoutersService,
    RouterApiService,
    PortMappingService,
    CredentialsService,
    WgIpPoolService,
    RouterSafeOnboardingService,
  ],
})
export class RoutersModule implements OnModuleInit {
  private readonly logger = new Logger(RoutersModule.name);

  constructor(private readonly portMappingService: PortMappingService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.portMappingService.restoreAllRules();
    } catch (err) {
      this.logger.error(
        `Failed to restore iptables rules on startup: ${(err as Error).message}`,
      );
    }
  }
}
