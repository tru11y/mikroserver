import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  StreamableFile,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { AccountingService } from "./accounting.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import {
  GenerateInvoiceDto,
  ListInvoicesQueryDto,
  RevenueByPeriodQueryDto,
  RevenueRangeQueryDto,
} from "./dto/accounting.dto";

@ApiTags("accounting")
@Controller({ path: "accounting", version: "1" })
@ApiBearerAuth()
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get("invoices")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "List invoices for current user" })
  findInvoices(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListInvoicesQueryDto,
  ) {
    return this.accountingService.findInvoices(
      user.sub,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Get("invoices/:id/pdf")
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Download invoice PDF" })
  async getInvoicePdf(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const [pdfBuffer, invoice] = await Promise.all([
      this.accountingService.generateInvoicePdf(id, user.sub),
      this.accountingService.getInvoice(id, user.sub),
    ]);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="facture-${(invoice as { number: string }).number}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });

    return new StreamableFile(pdfBuffer);
  }

  @Get("invoices/:id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Get invoice detail" })
  getInvoice(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.accountingService.getInvoice(id, user.sub);
  }

  @Post("invoices/generate")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Generate monthly invoice for current user" })
  generateInvoice(
    @CurrentUser() user: JwtPayload,
    @Body() body: GenerateInvoiceDto,
  ) {
    return this.accountingService.generateInvoice(
      user.sub,
      new Date(body.periodStart),
      new Date(body.periodEnd),
    );
  }

  @Get("revenue/by-router")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Revenue breakdown per router" })
  getRevenueByRouter(
    @CurrentUser() user: JwtPayload,
    @Query() query: RevenueRangeQueryDto,
  ) {
    const dateTo = query.to ? new Date(query.to) : new Date();
    const dateFrom = query.from
      ? new Date(query.from)
      : new Date(dateTo.getFullYear(), dateTo.getMonth() - 1, dateTo.getDate());
    return this.accountingService.getRevenueByRouter(
      user.sub,
      user.role,
      dateFrom,
      dateTo,
    );
  }

  @Get("revenue/by-period")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Monthly revenue for last N months" })
  getRevenueByPeriod(
    @CurrentUser() user: JwtPayload,
    @Query() query: RevenueByPeriodQueryDto,
  ) {
    return this.accountingService.getRevenueByPeriod(
      user.sub,
      user.role,
      query.months ?? 12,
    );
  }
}
