import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";

@ApiTags("admin")
@Controller({ path: "admin", version: "1" })
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * GET /v1/admin/operators
   * Lists all ADMIN users (operators) with their SaaS tier + usage statistics.
   * Access: SUPER_ADMIN only.
   */
  @Get("operators")
  @ApiOperation({
    summary: "List all operators with subscription tier and usage stats",
    description:
      "Returns every user with role ADMIN, enriched with their current SaaS tier, " +
      "router count, voucher count, and monthly/total revenue. " +
      "Restricted to SUPER_ADMIN.",
  })
  listOperators(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return this.adminService.listOperators(page, Math.min(limit, 100));
  }

  /**
   * GET /v1/admin/operators/:id
   * Returns a single operator's detail with full usage stats.
   * Access: SUPER_ADMIN only.
   */
  @Get("operators/:id")
  @ApiOperation({
    summary: "Get a single operator with full stats",
    description: "Restricted to SUPER_ADMIN.",
  })
  getOperator(@Param("id", ParseUUIDPipe) id: string) {
    return this.adminService.getOperator(id);
  }
}
