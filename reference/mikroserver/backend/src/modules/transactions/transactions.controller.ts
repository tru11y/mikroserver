import {
  Controller, Get, Post, Param, Body, ParseUUIDPipe, Query,
  DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '@prisma/client';
import { IsString, IsPhoneNumber, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class InitiatePaymentDto {
  @ApiProperty() @IsUUID() planId!: string;
  @ApiProperty() @IsString() customerPhone!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerName?: string;
}

@ApiTags('transactions')
@Controller({ path: 'transactions', version: '1' })
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Public()
  @Post('initiate')
  @ApiOperation({ summary: 'Initiate payment (from captive portal)' })
  initiate(@Body() dto: InitiatePaymentDto) {
    return this.transactionsService.initiatePayment(dto);
  }

  @Get()
  @ApiBearerAuth()
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'List transactions' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.transactionsService.findAll({ page, limit: Math.min(limit, 100) });
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles(UserRole.VIEWER)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.transactionsService.findOne(id);
  }
}
