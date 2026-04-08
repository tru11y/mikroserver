import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Body,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { VoucherService } from './voucher.service';
import { PdfService } from './pdf.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { UserRole } from '@prisma/client';

@ApiTags('vouchers')
@Controller({ path: 'vouchers', version: '1' })
@ApiBearerAuth()
export class VouchersController {
  constructor(
    private readonly voucherService: VoucherService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'List vouchers (scoped for resellers)' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @CurrentUser() user: JwtPayload,
  ) {
    // Resellers only see their own vouchers
    const createdById =
      user.role === UserRole.RESELLER ? user.sub : undefined;
    return this.voucherService.findAll(page, limit, createdById);
  }

  @Get(':id')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get a voucher by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.voucherService.findOne(id);
  }

  @Post(':id/revoke')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a voucher' })
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.voucherService.revokeVoucher(id);
  }

  @Post(':id/redeliver')
  @Roles(UserRole.RESELLER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Queue voucher delivery again to its assigned router' })
  redeliver(@Param('id', ParseUUIDPipe) id: string) {
    return this.voucherService.redeliverVoucher(id);
  }

  // ---------------------------------------------------------------------------
  // Manual bulk generation
  // ---------------------------------------------------------------------------

  @Post('generate/bulk')
  @Roles(UserRole.RESELLER)
  @ApiOperation({ summary: 'Manually generate N vouchers for a plan (MANUAL type)' })
  @ApiBody({
    schema: {
      properties: {
        planId: { type: 'string', format: 'uuid' },
        routerId: { type: 'string', format: 'uuid' },
        count: { type: 'integer', minimum: 1, maximum: 500 },
      },
      required: ['planId', 'routerId', 'count'],
    },
  })
  generateBulk(
    @Body() body: { planId: string; routerId: string; count: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.voucherService.generateBulk(
      body.planId,
      body.routerId,
      body.count,
      user.sub,
    );
  }

  // ---------------------------------------------------------------------------
  // PDF export
  // ---------------------------------------------------------------------------

  @Post('pdf')
  @Roles(UserRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Download a printable PDF sheet for the given voucher IDs' })
  @ApiBody({
    schema: {
      properties: {
        voucherIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        businessName: { type: 'string' },
      },
      required: ['voucherIds'],
    },
  })
  async downloadPdf(
    @Body() body: { voucherIds: string[]; businessName?: string },
    @Res() res: Response,
  ) {
    const tickets = await this.voucherService.getVouchersForPdf(body.voucherIds);
    const pdf = await this.pdfService.generateVoucherSheet(
      tickets,
      body.businessName,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tickets-${Date.now()}.pdf"`,
      'Content-Length': pdf.length.toString(),
    });
    res.end(pdf);
  }
}
