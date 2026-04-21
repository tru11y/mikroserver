import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { SaasModule } from "../saas/saas.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    SaasModule, // SaasService (subscribe/cancel/getOperatorSubscription)
    AuthModule, // AuthPasswordService (hashPassword)
  ],
  providers: [AdminService],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
