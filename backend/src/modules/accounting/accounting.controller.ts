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
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.accountingService.findInvoices(
      user.sub,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
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
    @Body() body: { periodStart: string; periodEnd: string },
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
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const dateTo = to ? new Date(to) : new Date();
    const dateFrom = from
      ? new Date(from)
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
    @Query("months") months?: number,
  ) {
    return this.accountingService.getRevenueByPeriod(
      user.sub,
      user.role,
      months ? Number(months) : 12,
    );
  }
}
