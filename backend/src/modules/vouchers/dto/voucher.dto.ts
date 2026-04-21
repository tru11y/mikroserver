import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class VerifyTicketDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  ticket!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  password?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  routerId?: string;
}

export class VoucherIdsDto {
  @ApiProperty({
    type: [String],
    description: "Voucher UUIDs",
    minItems: 1,
    maxItems: 1000,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @IsUUID("all", { each: true })
  voucherIds!: string[];
}

export class GenerateBulkVouchersDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  planId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  routerId!: string;

  @ApiProperty({ minimum: 1, maximum: 500 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  count!: number;

  @ApiPropertyOptional({ minimum: 4, maximum: 16 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(16)
  codeLength?: number;

  @ApiPropertyOptional({ maxLength: 12 })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  ticketPrefix?: string;

  @ApiPropertyOptional({ enum: ["PIN", "USER_PASSWORD"] })
  @IsOptional()
  @IsIn(["PIN", "USER_PASSWORD"])
  ticketType?: "PIN" | "USER_PASSWORD";

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  numericOnly?: boolean;

  @ApiPropertyOptional({ minimum: 4, maximum: 16 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(16)
  passwordLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  passwordNumericOnly?: boolean;
}

export class GenerateBatchVouchersDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  planId!: string;

  @ApiProperty({ minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  routerId?: string;
}

export class DownloadVoucherPdfDto extends VoucherIdsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeQrCode?: boolean;

  @ApiPropertyOptional({ enum: [10, 25, 50] })
  @IsOptional()
  @Type(() => Number)
  @IsIn([10, 25, 50])
  ticketsPerPage?: number;
}
