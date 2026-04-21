import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { AuditAction, UserRole } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { AuditService } from "./audit.service";
import { ListAuditLogsQueryDto } from "./dto/audit.dto";

@ApiTags("audit")
@Controller({ path: "audit", version: "1" })
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get("logs")
  @Roles(UserRole.VIEWER)
  @Permissions("audit.view")
  @ApiOperation({ summary: "List audit logs with operational filters" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "action", required: false, enum: AuditAction })
  @ApiQuery({ name: "entityType", required: false, type: String })
  @ApiQuery({ name: "entityId", required: false, type: String })
  @ApiQuery({ name: "actorId", required: false, type: String })
  @ApiQuery({ name: "routerId", required: false, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    example: "2026-03-15",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    example: "2026-03-16",
  })
  listLogs(
    @Query() query: ListAuditLogsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.auditService.findLogs(query, {
      sub: user.sub,
      role: user.role,
    });
  }
}
