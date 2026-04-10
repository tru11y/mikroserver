import { Module } from "@nestjs/common";
import { RoutersService } from "./routers.service";
import { RoutersController } from "./routers.controller";
import { RouterApiService } from "./router-api.service";
import { AuditModule } from "../audit/audit.module";
import { SaasModule } from "../saas/saas.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [AuditModule, SaasModule, NotificationsModule],
  providers: [RoutersService, RouterApiService],
  controllers: [RoutersController],
  exports: [RoutersService, RouterApiService],
})
export class RoutersModule {}
