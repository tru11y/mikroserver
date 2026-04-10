import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsEnum,
  Matches,
  IsIn,
} from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PlanStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  PLAN_DURATION_MODES,
  PLAN_TICKET_TYPES,
} from "../plan-ticket-settings";

export class CreatePlanDto {
  @ApiProperty({ example: "1 Hour WiFi" })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: "1-hour-wifi",
    description: "Auto-generated from name if omitted",
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/^[a-z0-9-]+$/, {
    message: "Slug must be lowercase alphanumeric with hyphens",
  })
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 60, description: "Duration in minutes" })
  @IsInt()
  @Min(5)
  @Max(525600) // 1 year
  @Type(() => Number)
  durationMinutes!: number;

  @ApiProperty({ example: 500, description: "Price in FCFA" })
  @IsInt()
  @Min(100)
  @Max(100000)
  @Type(() => Number)
  priceXof!: number;

  @ApiPropertyOptional({
    description: "Download speed in kbps, null = unlimited",
  })
  @IsOptional()
  @IsInt()
  @Min(64)
  @Type(() => Number)
  downloadKbps?: number;

  @ApiPropertyOptional({
    description: "Upload speed in kbps, null = unlimited",
  })
  @IsOptional()
  @IsInt()
  @Min(64)
  @Type(() => Number)
  uploadKbps?: number;

  @ApiPropertyOptional({ description: "Data limit in MB, null = unlimited" })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Type(() => Number)
  dataLimitMb?: number;

  @ApiPropertyOptional({ default: "default" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  userProfile?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  displayOrder?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiPropertyOptional({ enum: PLAN_TICKET_TYPES, default: "PIN" })
  @IsOptional()
  @IsIn(PLAN_TICKET_TYPES)
  ticketType?: "PIN" | "USER_PASSWORD";

  @ApiPropertyOptional({ enum: PLAN_DURATION_MODES, default: "ELAPSED" })
  @IsOptional()
  @IsIn(PLAN_DURATION_MODES)
  durationMode?: "ELAPSED" | "PAUSED";

  @ApiPropertyOptional({ example: "1m" })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  @Matches(/^[A-Za-z0-9]*$/, {
    message: "Ticket prefix must be alphanumeric",
  })
  ticketPrefix?: string;

  @ApiPropertyOptional({ example: 8, minimum: 4, maximum: 16 })
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(16)
  @Type(() => Number)
  ticketCodeLength?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  ticketNumericOnly?: boolean;

  @ApiPropertyOptional({ example: 8, minimum: 4, maximum: 16 })
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(16)
  @Type(() => Number)
  ticketPasswordLength?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  ticketPasswordNumericOnly?: boolean;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  usersPerTicket?: number;
}

export class UpdatePlanDto {
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

  @ApiPropertyOptional({ description: "Duration in minutes" })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(525600)
  @Type(() => Number)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(100000)
  @Type(() => Number)
  priceXof?: number;

  @ApiPropertyOptional({ enum: PlanStatus })
  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;

  @ApiPropertyOptional({
    description: "Download speed in kbps, null = unlimited",
  })
  @IsOptional()
  @IsInt()
  @Min(64)
  @Transform(({ value }: { value: unknown }) =>
    value === null || value === undefined ? value : Number(value),
  )
  downloadKbps?: number | null;

  @ApiPropertyOptional({
    description: "Upload speed in kbps, null = unlimited",
  })
  @IsOptional()
  @IsInt()
  @Min(64)
  @Transform(({ value }: { value: unknown }) =>
    value === null || value === undefined ? value : Number(value),
  )
  uploadKbps?: number | null;

  @ApiPropertyOptional({ description: "Data limit in MB, null = unlimited" })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Transform(({ value }: { value: unknown }) =>
    value === null || value === undefined ? value : Number(value),
  )
  dataLimitMb?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  userProfile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  displayOrder?: number;

  @ApiPropertyOptional({ enum: PLAN_TICKET_TYPES })
  @IsOptional()
  @IsIn(PLAN_TICKET_TYPES)
  ticketType?: "PIN" | "USER_PASSWORD";

  @ApiPropertyOptional({ enum: PLAN_DURATION_MODES })
  @IsOptional()
  @IsIn(PLAN_DURATION_MODES)
  durationMode?: "ELAPSED" | "PAUSED";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(12)
  @Matches(/^[A-Za-z0-9]*$/, {
    message: "Ticket prefix must be alphanumeric",
  })
  ticketPrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(16)
  @Type(() => Number)
  ticketCodeLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ticketNumericOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(16)
  @Type(() => Number)
  ticketPasswordLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ticketPasswordNumericOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  usersPerTicket?: number;
}
