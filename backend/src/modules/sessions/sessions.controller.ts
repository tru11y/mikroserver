import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from "@nestjs/swagger";
import { SessionsService } from "./sessions.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";

@ApiTags("sessions")
@Controller({ path: "sessions", version: "1" })
@ApiBearerAuth()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get("history")
  @Roles(UserRole.VIEWER)
  @Permissions("sessions.view")
  @ApiOperation({
    summary: "Paginated session history from DB with voucher/plan enrichment",
  })
  getHistory(
    @CurrentUser() user: JwtPayload,
    @Query("routerId") routerId?: string,
    @Query("macAddress") macAddress?: string,
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.sessionsService.findHistory({
      routerId,
      macAddress,
      status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      requestingUserId: user.sub,
      requestingUserRole: user.role,
    });
  }

  @Get("active")
  @Roles(UserRole.VIEWER)
  @Permissions("sessions.view")
  @ApiOperation({ summary: "Get active hotspot sessions (tenant-scoped)" })
  getActive(
    @CurrentUser() user: JwtPayload,
    @Query("routerId") routerId?: string,
  ) {
    return this.sessionsService.findActive(routerId, {
      sub: user.sub,
      role: user.role,
    });
  }

  @Get("by-mac")
  @Roles(UserRole.VIEWER)
  @Permissions("sessions.view")
  @ApiOperation({ summary: "Get active DB sessions by MAC address" })
  getByMac(
    @Query("macAddress") macAddress: string,
    @Query("routerId") routerId?: string,
  ) {
    return this.sessionsService.findByMac(macAddress, routerId);
  }

  @Post("terminate")
  @Roles(UserRole.VIEWER)
  @Permissions("sessions.terminate")
  @ApiOperation({ summary: "Terminate a session" })
  @ApiBody({
    schema: {
      properties: {
        routerId: { type: "string", format: "uuid" },
        mikrotikId: { type: "string" },
      },
      required: ["routerId", "mikrotikId"],
    },
  })
  terminate(@Body() body: { routerId: string; mikrotikId: string }) {
    return this.sessionsService.terminate(body.routerId, body.mikrotikId);
  }

  @Delete(":id/disconnect")
  @Roles(UserRole.ADMIN)
  @Permissions("sessions.terminate")
  @ApiOperation({ summary: "Force disconnect a session by DB session ID" })
  @ApiParam({ name: "id", type: "string", format: "uuid" })
  forceDisconnect(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sessionsService.forceDisconnect(id, user.sub, user.role);
  }
}
