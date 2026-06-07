import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  Headers,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { TransactionsService } from "./transactions.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { UserRole, TransactionStatus, PaymentProvider } from "@prisma/client";
import { IsString, IsOptional, IsUUID, IsEnum } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

class InitiatePaymentDto {
  @ApiProperty() @IsUUID() planId!: string;
  @ApiProperty() @IsString() customerPhone!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerName?: string;
  @ApiPropertyOptional({ enum: PaymentProvider, default: PaymentProvider.WAVE })
  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;
}

@ApiTags("transactions")
@Controller({ path: "transactions", version: "1" })
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Public()
  @Post("initiate")
  @ApiOperation({ summary: "Initiate payment (from captive portal)" })
  initiate(
    @Body() dto: InitiatePaymentDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("Idempotency-Key header is required");
    }
    return this.transactionsService.initiatePayment({
      planId: dto.planId,
      customerPhone: dto.customerPhone,
      customerName: dto.customerName,
      provider: dto.provider,
      idempotencyKey,
    });
  }

  @Public()
  @Get("portal/status/:id")
  @ApiOperation({ summary: "Get portal payment status (public, for polling)" })
  portalStatus(@Param("id", ParseUUIDPipe) id: string) {
    return this.transactionsService.getPortalStatus(id);
  }

  @Get("summary")
  @ApiBearerAuth()
  @Roles(UserRole.VIEWER)
  @Permissions("transactions.view")
  @ApiOperation({
    summary: "Transaction KPI summary — counts by status + total revenue",
  })
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.transactionsService.summary({ sub: user.sub, role: user.role });
  }

  @Get()
  @ApiBearerAuth()
  @Roles(UserRole.VIEWER)
  @Permissions("transactions.view")
  @ApiOperation({
    summary: "List transactions (tenant-scoped by router owner)",
  })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const validStatus =
      status &&
      Object.values(TransactionStatus).includes(status as TransactionStatus)
        ? (status as TransactionStatus)
        : undefined;

    return this.transactionsService.findAll({
      page,
      limit: Math.min(limit, 100),
      status: validStatus,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      actor: { sub: user.sub, role: user.role },
    });
  }

  @Get(":id")
  @ApiBearerAuth()
  @Roles(UserRole.VIEWER)
  @Permissions("transactions.view")
  findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.transactionsService.findOne(id, {
      sub: user.sub,
      role: user.role,
    });
  }
}
