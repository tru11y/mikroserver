import { Module } from "@nestjs/common";
import { HotspotSetupService } from "./hotspot-setup.service";
import { HotspotSetupController } from "./hotspot-setup.controller";
import { MikroTikClientModule } from "../mikrotik-client/mikrotik-client.module";
import { RoutersModule } from "../routers/routers.module";

@Module({
  imports: [MikroTikClientModule, RoutersModule],
  controllers: [HotspotSetupController],
  providers: [HotspotSetupService],
})
export class HotspotSetupModule {}
