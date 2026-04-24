import {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FinalizeOnboardingDto {
  @ApiProperty()
  @IsUUID()
  tunnelId!: string;

  @ApiProperty({ example: "Cybercafé Plateau" })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(256)
  comment?: string;

  @ApiProperty({ example: "hsfl-agent" })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  agentUsername!: string;

  @ApiProperty({ description: "Agent password (min 16 chars)" })
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  agentPassword!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(128)
  identity?: string;

  @ApiPropertyOptional({ example: "7.16.2" })
  @IsString()
  @IsOptional()
  @MaxLength(32)
  routerOsVersion?: string;

  @ApiPropertyOptional({ example: "RB951Ui-2HnD" })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  boardName?: string;

  @ApiPropertyOptional({ example: "mipsbe" })
  @IsString()
  @IsOptional()
  @MaxLength(32)
  architecture?: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  hotspotAlreadyConfigured!: boolean;

  @ApiPropertyOptional({ example: "bridge" })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  hotspotInterface?: string;
}

export class RouterOnboardingResponseDto {
  id!: string;
  name!: string;
  status!: string;
  tunnelIp!: string;
  identity?: string;
  routerOsVersion?: string;
  boardName?: string;
  hotspotConfigured!: boolean;
}
