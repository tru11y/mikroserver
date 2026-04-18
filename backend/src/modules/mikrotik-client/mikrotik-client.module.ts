import { Module } from "@nestjs/common";
import { MikroTikClientFactory } from "./mikrotik-client.factory";

@Module({
  providers: [MikroTikClientFactory],
  exports: [MikroTikClientFactory],
})
export class MikroTikClientModule {}
