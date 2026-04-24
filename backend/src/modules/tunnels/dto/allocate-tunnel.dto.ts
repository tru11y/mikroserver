import { ApiProperty } from "@nestjs/swagger";

export class AllocateTunnelResponseDto {
  @ApiProperty()
  tunnelId!: string;

  @ApiProperty({ example: "10.66.66.2" })
  tunnelIp!: string;

  @ApiProperty({
    description: "Router private key — returned ONCE, never stored",
  })
  clientPrivateKey!: string;

  @ApiProperty()
  serverPublicKey!: string;

  @ApiProperty({ example: "vps.hotspotflow.ci:51820" })
  serverEndpoint!: string;
}
