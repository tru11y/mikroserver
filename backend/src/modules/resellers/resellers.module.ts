import { Module } from "@nestjs/common";
import { ResellersService } from "./resellers.service";
import { ResellersController } from "./resellers.controller";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  providers: [ResellersService],
  controllers: [ResellersController],
  exports: [ResellersService],
})
export class ResellersModule {}
