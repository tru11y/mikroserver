import { Module } from "@nestjs/common";
import { AccountingService } from "./accounting.service";
import { AccountingController } from "./accounting.controller";

@Module({
  providers: [AccountingService],
  controllers: [AccountingController],
  exports: [AccountingService],
})
export class AccountingModule {}
