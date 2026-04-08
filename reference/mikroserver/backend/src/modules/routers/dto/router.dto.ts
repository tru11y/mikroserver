import {
  IsString,
  IsIP,
  IsInt,
  IsOptional,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRouterDto {
  @ApiProperty({ example: 'Abidjan-Centre-01' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'Plateau, Abidjan' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiProperty({ example: '10.66.66.2', description: 'WireGuard tunnel IP' })
  @IsIP('4')
  @Matches(/^10\.66\.66\.\d{1,3}$/, {
    message: 'WireGuard IP must be in 10.66.66.0/24 subnet',
  })
  wireguardIp!: string;

  @ApiPropertyOptional({ default: 8728 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  apiPort?: number;

  @ApiProperty({ example: 'api-user' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  apiUsername!: string;

  @ApiProperty({ description: 'RouterOS API password (stored as plain for API use)' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  apiPassword!: string;

  @ApiPropertyOptional({ default: 'default' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  hotspotProfile?: string;

  @ApiPropertyOptional({ default: 'hotspot1' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  hotspotServer?: string;
}

export class UpdateRouterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  hotspotProfile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  hotspotServer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  apiUsername?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  apiPassword?: string;
}
