import { Module } from "@nestjs/common";
import { ProvisioningService } from "./provisioning.service";
import { ProvisioningController } from "./provisioning.controller";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  providers: [ProvisioningService],
  controllers: [ProvisioningController],
  exports: [ProvisioningService],
})
export class ProvisioningModule {}
