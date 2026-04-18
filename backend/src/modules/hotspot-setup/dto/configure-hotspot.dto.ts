import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIP,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ConfigureHotspotDto {
  @ApiProperty({ example: "bridge", description: "Interface for hotspot" })
  @IsString()
  interfaceName!: string;

  @ApiProperty({ example: "10.5.50.0/24" })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+\.\d+\/\d+$/)
  network!: string;

  @ApiProperty({ example: "10.5.50.1" })
  @IsIP("4")
  gateway!: string;

  @ApiPropertyOptional({ example: "hotspot.local" })
  @IsString()
  @IsOptional()
  dnsName?: string;

  @ApiPropertyOptional({ example: "10.5.50.10" })
  @IsIP("4")
  @IsOptional()
  poolStart?: string;

  @ApiPropertyOptional({ example: "10.5.50.254" })
  @IsIP("4")
  @IsOptional()
  poolEnd?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  useRadius?: boolean;
}
