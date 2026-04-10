import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  IsInt,
  Min,
  IsDateString,
} from "class-validator";
import { SubscriptionStatus, PaymentMethod } from "@prisma/client";

export class CreateSubscriptionDto {
  @ApiProperty({ description: "Plan ID to subscribe to" })
  @IsNotEmpty()
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional({
    description: "Voucher ID to link (if using existing voucher)",
  })
  @IsOptional()
  @IsUUID()
  voucherId?: string;

  @ApiProperty({ description: "Start date of subscription" })
  @IsNotEmpty()
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: "End date of subscription" })
  @IsNotEmpty()
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: "Whether to auto-renew", default: true })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @ApiProperty({ description: "Price in XOF (FCFA)" })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  priceXof!: number;

  @ApiPropertyOptional({ description: "Payment method", enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: "Next billing date" })
  @IsOptional()
  @IsDateString()
  nextBillingAt?: string;
}

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({
    description: "Subscription status",
    enum: SubscriptionStatus,
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ description: "Whether to auto-renew" })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @ApiPropertyOptional({ description: "Next billing date" })
  @IsOptional()
  @IsDateString()
  nextBillingAt?: string;

  @ApiPropertyOptional({ description: "Cancellation reason" })
  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @ApiPropertyOptional({ description: "Payment method", enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

export class CancelSubscriptionDto {
  @ApiPropertyOptional({ description: "Reason for cancellation" })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RenewSubscriptionDto {
  @ApiPropertyOptional({ description: "New end date (if extending)" })
  @IsOptional()
  @IsDateString()
  newEndDate?: string;

  @ApiPropertyOptional({ description: "New price in XOF (if changed)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  newPriceXof?: number;
}

export class SubscriptionResponseDto {
  @ApiProperty({ description: "Subscription ID" })
  id!: string;

  @ApiProperty({ description: "User ID" })
  userId!: string;

  @ApiProperty({ description: "Plan ID" })
  planId!: string;

  @ApiPropertyOptional({ description: "Voucher ID" })
  voucherId?: string;

  @ApiProperty({ description: "Subscription status", enum: SubscriptionStatus })
  status!: SubscriptionStatus;

  @ApiProperty({ description: "Start date" })
  startDate!: Date;

  @ApiProperty({ description: "End date" })
  endDate!: Date;

  @ApiProperty({ description: "Auto renew flag" })
  autoRenew!: boolean;

  @ApiProperty({ description: "Price in XOF" })
  priceXof!: number;

  @ApiPropertyOptional({ description: "Payment method", enum: PaymentMethod })
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: "Last billed date" })
  lastBilledAt?: Date;

  @ApiPropertyOptional({ description: "Next billing date" })
  nextBillingAt?: Date;

  @ApiPropertyOptional({ description: "Cancelled date" })
  cancelledAt?: Date;

  @ApiPropertyOptional({ description: "Cancellation reason" })
  cancellationReason?: string;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt!: Date;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt!: Date;

  @ApiPropertyOptional({ description: "Plan details" })
  plan?: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    durationMinutes: number;
    priceXof: number;
  };

  @ApiPropertyOptional({ description: "Voucher details" })
  voucher?: {
    id: string;
    code: string;
    status: string;
  };
}
