import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Delete,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Body,
  Res,
  StreamableFile,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import { FastifyReply } from "fastify";
import { VoucherService } from "./voucher.service";
import { PdfService } from "./pdf.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { UserRole, VoucherStatus } from "@prisma/client";

@ApiTags("vouchers")
@Controller({ path: "vouchers", version: "1" })
@ApiBearerAuth()
export class VouchersController {
  constructor(
    private readonly voucherService: VoucherService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  @Roles(UserRole.VIEWER)
  @Permissions("tickets.view")
  @ApiOperation({ summary: "List vouchers (tenant-scoped by router owner)" })
  findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("status") status: string | undefined,
    @Query("search") search: string | undefined,
    @Query("usageState")
    usageState: "ALL" | "UNUSED" | "USED" | "READY" | "ISSUES" | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    const statuses = status
      ? status
          .split(",")
          .map((value) => value.trim())
          .filter((value): value is VoucherStatus =>
            Object.values(VoucherStatus).includes(value as VoucherStatus),
          )
      : undefined;

    return this.voucherService.findAll(page, limit, user, {
      search,
      statuses,
      usageState,
    });
  }

  @Get("inventory/summary")
  @Roles(UserRole.VIEWER)
  @Permissions("tickets.view")
  @ApiOperation({
    summary: "Get ticket inventory summary for stock and terrain operations",
  })
  inventorySummary(@CurrentUser() user: JwtPayload) {
    return this.voucherService.getInventorySummary(user);
  }

  @Post("verify")
  @Roles(UserRole.VIEWER)
  @Permissions("tickets.verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Verify a ticket using code + password for admin/reseller use",
  })
  @ApiBody({
    schema: {
      properties: {
        ticket: { type: "string" },
        password: { type: "string", nullable: true },
        routerId: { type: "string", format: "uuid", nullable: true },
      },
      required: ["ticket"],
    },
  })
  verify(
    @Body() body: { ticket: string; password?: string; routerId?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.voucherService.verifyVoucherForOperator(
      body.ticket,
      body.password,
      user,
      body.routerId,
    );
  }

  @Post("verify/delete")
  @Roles(UserRole.ADMIN)
  @Permissions("tickets.delete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Permanently remove a verified ticket from MikroTik, preserving SaaS history when needed",
  })
  @ApiBody({
    schema: {
      properties: {
        ticket: { type: "string" },
        password: { type: "string", nullable: true },
        routerId: { type: "string", format: "uuid", nullable: true },
      },
      required: ["ticket"],
    },
  })
  deleteVerifiedTicket(
    @Body() body: { ticket: string; password?: string; routerId?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.voucherService.deleteTicketPermanently(
      body.ticket,
      body.password,
      user,
      body.routerId,
    );
  }

  @Post("delete/bulk")
  @Roles(UserRole.VIEWER)
  @Permissions("tickets.delete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Safely delete selected unused vouchers and report skipped ones",
  })
  @ApiBody({
    schema: {
      properties: {
        voucherIds: {
          type: "array",
          items: { type: "string", format: "uuid" },
        },
      },
      required: ["voucherIds"],
    },
  })
  bulkDelete(
    @Body() body: { voucherIds: string[] },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.voucherService.bulkDeleteVouchers(body.voucherIds, user);
  }

  @Get(":id")
  @Roles(UserRole.VIEWER)
  @Permissions("tickets.view")
  @ApiOperation({ summary: "Get a voucher by ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.voucherService.findOne(id);
  }

  @Post(":id/revoke")
  @Roles(UserRole.VIEWER)
  @Permissions("tickets.update")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke a voucher" })
  revoke(@Param("id", ParseUUIDPipe) id: string) {
    return this.voucherService.revokeVoucher(id);
  }

  @Post(":id/redeliver")
  @Roles(UserRole.VIEWER)
  @Permissions("tickets.update")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Queue voucher delivery again to its assigned router",
  })
  redeliver(@Param("id", ParseUUIDPipe) id: string) {
    return this.voucherService.redeliverVoucher(id);
  }

  @Delete(":id")
  @Roles(UserRole.VIEWER)
  @Permissions("tickets.delete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete an unused voucher safely" })
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.voucherService.deleteVoucher(id, user);
  }

  // ---------------------------------------------------------------------------
  // Print (alias for PDF — used by frontend print button)
  // ---------------------------------------------------------------------------

  @Post("print")
  @Roles(UserRole.VIEWER)
  @Permissions("tickets.export")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Generate printable PDF for selected voucher IDs (print alias)",
  })
  @ApiBody({
    schema: {
      properties: {
        voucherIds: {
          type: "array",
          items: { type: "string", format: "uuid" },
        },
      },
      required: ["voucherIds"],
    },
  })
  async printVouchers(
    @Body() body: { voucherIds: string[] },
    @Res({ passthrough: true }) reply: FastifyReply,
    @CurrentUser() user: JwtPayload,
  ): Promise<StreamableFile> {
    const tickets = await this.voucherService.getVouchersForPdf(
      body.voucherIds,
      user,
    );
    const pdf = await this.pdfService.generateVoucherSheet(tickets, undefined, {
      includeQrCode: true,
    });

    reply.header("Content-Type", "application/pdf");
    reply.header(
      "Content-Disposition",
      `attachment; filename="tickets-wifi-${Date.now()}.pdf"`,
    );
    reply.header("Content-Length", pdf.length.toString());

    return new StreamableFile(pdf);
  }

  // ---------------------------------------------------------------------------
  // Manual bulk generation
  // ---------------------------------------------------------------------------

  @Post("generate/bulk")
  @Roles(UserRole.VIEWER)
  @Permissions("tickets.create")
  @ApiOperation({
    summary: "Manually generate N vouchers for a plan (MANUAL type)",
  })
  @ApiBody({
    schema: {
      properties: {
        planId: { type: "string", format: "uuid" },
        routerId: { type: "string", format: "uuid" },
        count: { type: "integer", minimum: 1, maximum: 500 },
        codeLength: { type: "integer", minimum: 4, maximum: 16 },
        ticketPrefix: { type: "string", maxLength: 12 },
        ticketType: { type: "string", enum: ["PIN", "USER_PASSWORD"] },
        numericOnly: { type: "boolean" },
        passwordLength: { type: "integer", minimum: 4, maximum: 16 },
        passwordNumericOnly: { type: "boolean" },
      },
      required: ["planId", "routerId", "count"],
    },
  })
  generateBulk(
    @Body()
    body: {
      planId: string;
      routerId: string;
      count: number;
      codeLength?: number;
      ticketPrefix?: string;
      ticketType?: "PIN" | "USER_PASSWORD";
      numericOnly?: boolean;
      passwordLength?: number;
      passwordNumericOnly?: boolean;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.voucherService.generateBulk(
      body.planId,
      body.routerId,
      body.count,
      user.sub,
      {
        codeLength: body.codeLength,
        ticketPrefix: body.ticketPrefix,
        ticketType: body.ticketType,
        numericOnly: body.numericOnly,
        passwordLength: body.passwordLength,
        passwordNumericOnly: body.passwordNumericOnly,
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Batch generate (simplified — routerId optional, max 100)
  // ---------------------------------------------------------------------------

  @Post("batch")
  @Roles(UserRole.VIEWER)
  @Permissions("tickets.create")
  @ApiOperation({
    summary:
      "Generate a batch of N vouchers for a plan (routerId optional, max 100)",
  })
  @ApiBody({
    schema: {
      properties: {
        planId: { type: "string", format: "uuid" },
        quantity: { type: "integer", minimum: 1, maximum: 100 },
        routerId: { type: "string", format: "uuid", nullable: true },
      },
      required: ["planId", "quantity"],
    },
  })
  generateBatch(
    @Body() body: { planId: string; quantity: number; routerId?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.voucherService.generateBulk(
      body.planId,
      body.routerId,
      body.quantity,
      user.sub,
    );
  }

  // ---------------------------------------------------------------------------
  // Batch print PDF (6 cards per A4 page with QR codes)
  // ---------------------------------------------------------------------------

  @Post("batch-print")
  @Roles(UserRole.VIEWER)
  @Permissions("tickets.export")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Generate a printable PDF sheet (6 cards/page, QR codes) for a batch of voucher IDs",
  })
  @ApiBody({
    schema: {
      properties: {
        voucherIds: {
          type: "array",
          items: { type: "string", format: "uuid" },
          maxItems: 100,
        },
      },
      required: ["voucherIds"],
    },
  })
  async batchPrint(
    @Body() body: { voucherIds: string[] },
    @Res({ passthrough: true }) reply: FastifyReply,
    @CurrentUser() user: JwtPayload,
  ): Promise<StreamableFile> {
    const tickets = await this.voucherService.getVouchersForPdf(
      body.voucherIds,
      user,
    );
    const pdf = await this.pdfService.generateBatchSheet(tickets);

    reply.header("Content-Type", "application/pdf");
    reply.header(
      "Content-Disposition",
      `attachment; filename="lot-tickets-${Date.now()}.pdf"`,
    );
    reply.header("Content-Length", pdf.length.toString());

    return new StreamableFile(pdf);
  }

  // ---------------------------------------------------------------------------
  // PDF export
  // ---------------------------------------------------------------------------

  @Post("pdf")
  @Roles(UserRole.VIEWER)
  @Permissions("tickets.export")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Download a printable PDF sheet for the given voucher IDs",
  })
  @ApiBody({
    schema: {
      properties: {
        voucherIds: {
          type: "array",
          items: { type: "string", format: "uuid" },
        },
        businessName: { type: "string" },
        includeQrCode: { type: "boolean" },
        ticketsPerPage: { type: "integer", enum: [10, 25, 50] },
      },
      required: ["voucherIds"],
    },
  })
  async downloadPdf(
    @Body()
    body: {
      voucherIds: string[];
      businessName?: string;
      includeQrCode?: boolean;
      ticketsPerPage?: number;
    },
    @Res({ passthrough: true }) reply: FastifyReply,
    @CurrentUser() user: JwtPayload,
  ): Promise<StreamableFile> {
    const tickets = await this.voucherService.getVouchersForPdf(
      body.voucherIds,
      user,
    );
    const pdf = await this.pdfService.generateVoucherSheet(
      tickets,
      body.businessName,
      {
        includeQrCode: body.includeQrCode,
        ticketsPerPage: body.ticketsPerPage,
      },
    );

    reply.header("Content-Type", "application/pdf");
    reply.header(
      "Content-Disposition",
      `attachment; filename="tickets-${Date.now()}.pdf"`,
    );
    reply.header("Content-Length", pdf.length.toString());

    return new StreamableFile(pdf);
  }
}
