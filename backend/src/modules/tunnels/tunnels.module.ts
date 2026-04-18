import { Module } from "@nestjs/common";
import { TunnelsService } from "./tunnels.service";
import { TunnelsController } from "./tunnels.controller";
import { KeygenService } from "./keygen.service";
import { CidrAllocatorService } from "./cidr-allocator.service";
import { WireguardCliService } from "./wireguard-cli.service";

@Module({
  controllers: [TunnelsController],
  providers: [
    TunnelsService,
    KeygenService,
    CidrAllocatorService,
    WireguardCliService,
    {
      provide: "IWireguardCliService",
      useExisting: WireguardCliService,
    },
  ],
  exports: [TunnelsService, KeygenService, WireguardCliService],
})
export class TunnelsModule {}
