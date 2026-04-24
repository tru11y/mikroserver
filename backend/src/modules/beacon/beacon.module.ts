import { Module } from "@nestjs/common";
import { BeaconController } from "./beacon.controller";
import { RouterHealthProcessor } from "./router-health.processor";

@Module({
  controllers: [BeaconController],
  providers: [RouterHealthProcessor],
})
export class BeaconModule {}
