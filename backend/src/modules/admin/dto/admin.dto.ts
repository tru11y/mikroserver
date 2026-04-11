import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { BillingCycle } from "@prisma/client";

export class ProvisionOperatorDto {
  @ApiProperty({ example: "jean.kouassi@wifi-abidjan.ci" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "Jean" })
  @IsString()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: "Kouassi" })
  @IsString()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({ example: "+2250700000000" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    description: "UUID du tier SaaS à assigner immédiatement",
  })
  @IsOptional()
  @IsUUID()
  tierId?: string;

  @ApiPropertyOptional({ enum: BillingCycle, default: BillingCycle.MONTHLY })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({
    description:
      "Mot de passe temporaire. Si absent, un mot de passe aléatoire est généré.",
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  tempPassword?: string;
}

export class AssignSubscriptionDto {
  @ApiProperty({ description: "UUID du tier SaaS" })
  @IsUUID()
  tierId: string;

  @ApiPropertyOptional({ enum: BillingCycle, default: BillingCycle.MONTHLY })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;
}

export class RenewSubscriptionDto {
  @ApiPropertyOptional({
    description:
      "Nombre de mois à ajouter à la date de fin actuelle. Défaut: 1 (mensuel) ou 12 (annuel) selon le billing cycle actuel.",
  })
  @IsOptional()
  months?: number;
}

export class CancelSubscriptionDto {
  @ApiPropertyOptional({ description: "Raison de la résiliation" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
