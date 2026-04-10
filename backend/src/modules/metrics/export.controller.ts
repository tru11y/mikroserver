import { Controller, Get, Query, Res } from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { FastifyReply } from "fastify";
import { ExportService } from "./export.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("export")
@Controller({ path: "export", version: "1" })
@ApiBearerAuth()
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get("transactions")
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: "Export transactions as CSV" })
  @ApiQuery({ name: "from", required: false, type: String })
  @ApiQuery({ name: "to", required: false, type: String })
  async exportTransactions(
    @CurrentUser() user: JwtPayload,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Res() res: FastifyReply,
  ) {
    const csv = await this.exportService.exportTransactionsCsv(
      user.sub,
      user.role,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
    const filename = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.header("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv); // BOM for Excel
  }

  @Get("customers")
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: "Export customer profiles as CSV" })
  async exportCustomers(
    @CurrentUser() user: JwtPayload,
    @Res() res: FastifyReply,
  ) {
    const csv = await this.exportService.exportCustomersCsv(
      user.sub,
      user.role,
    );
    const filename = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.header("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv);
  }
}
