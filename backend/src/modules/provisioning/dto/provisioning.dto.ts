import { Type } from "class-transformer";
import {
  IsIP,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class StartProvisioningDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  routerName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  apiUsername!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  apiPassword!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIP("4")
  publicIp?: string;

  @ApiPropertyOptional({ default: 8728, minimum: 1, maximum: 65535 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  apiPort?: number;
}

export class PrepareProvisioningDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  routerName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  apiUsername?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  apiPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIP("4")
  publicIp?: string;

  @ApiPropertyOptional({ default: 8728, minimum: 1, maximum: 65535 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  apiPort?: number;
}

export class FinalizeProvisioningDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  routerIdentity!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  hotspotName!: string;
}
