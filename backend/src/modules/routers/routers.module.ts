import { Module } from "@nestjs/common";
import { RoutersService } from "./routers.service";
import { RoutersController } from "./routers.controller";
import { RouterApiService } from "./router-api.service";
import { RouterAccessService } from "./router-access.service";
import { RouterAccessController } from "./router-access.controller";
import { PortMappingService } from "./port-mapping.service";
import { PortMappingController } from "./port-mapping.controller";
import { AuditModule } from "../audit/audit.module";
import { SaasModule } from "../saas/saas.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [AuditModule, SaasModule, NotificationsModule],
  providers: [RoutersService, RouterApiService, RouterAccessService, PortMappingService],
  controllers: [RoutersController, RouterAccessController, PortMappingController],
  exports: [RoutersService, RouterApiService],
})
export class RoutersModule {}
