import { Module } from "@nestjs/common";
import { SessionsController } from "./sessions.controller";
import { SessionsService } from "./sessions.service";
import { RoutersModule } from "../routers/routers.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CustomersModule } from "../customers/customers.module";

@Module({
  imports: [RoutersModule, NotificationsModule, CustomersModule],
  providers: [SessionsService],
  controllers: [SessionsController],
  exports: [SessionsService],
})
export class SessionsModule {}
