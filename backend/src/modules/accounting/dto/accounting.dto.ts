import { Type } from "class-transformer";
import { IsISO8601, IsInt, IsOptional, Max, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ListInvoicesQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class GenerateInvoiceDto {
  @ApiProperty({ example: "2026-04-01T00:00:00.000Z" })
  @IsISO8601()
  periodStart!: string;

  @ApiProperty({ example: "2026-04-30T23:59:59.999Z" })
  @IsISO8601()
  periodEnd!: string;
}

export class RevenueRangeQueryDto {
  @ApiPropertyOptional({ example: "2026-03-01T00:00:00.000Z" })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: "2026-03-31T23:59:59.999Z" })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class RevenueByPeriodQueryDto {
  @ApiPropertyOptional({ default: 12, minimum: 1, maximum: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  months?: number = 12;
}
