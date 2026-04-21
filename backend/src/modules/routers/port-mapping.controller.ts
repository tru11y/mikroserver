import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PortMappingService } from "./port-mapping.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { Roles } from "../auth/decorators/roles.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { UserRole } from "@prisma/client";

class AllocatePortsDto {
  @ApiPropertyOptional({
    description: "VPN IP override — if omitted, taken from router.wireguardIp",
    example: "10.66.66.2",
  })
  @IsOptional()
  @IsString()
  vpnIp?: string;
}

@ApiTags("router-port-mapping")
@Controller({ path: "routers", version: "1" })
@ApiBearerAuth()
export class PortMappingController {
  constructor(private readonly portMappingService: PortMappingService) {}

  /**
   * Allocate 3 public ports and write iptables DNAT rules.
   * POST /routers/:id/port-map
   */
  @Post(":id/port-map")
  @Roles(UserRole.ADMIN)
  @Permissions("routers.manage")
  @ApiOperation({
    summary: "Allocate public ports + apply iptables DNAT for router",
  })
  async allocate(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AllocatePortsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const vpnIp = dto.vpnIp ?? (await this.portMappingService.resolveVpnIp(id));
    return this.portMappingService.allocatePortsForRouter(id, vpnIp);
  }

  /**
   * Get port map + access URLs built with the VPS public IP.
   * GET /routers/:id/port-map
   */
  @Get(":id/port-map")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.view")
  @ApiOperation({ summary: "Get public access URLs for this router" })
  getAccessInfo(@Param("id", ParseUUIDPipe) id: string) {
    return this.portMappingService.getAccessInfo(id);
  }

  /**
   * Re-apply iptables rules (e.g., after VPS reboot).
   * POST /routers/:id/port-map/apply-rules
   */
  @Post(":id/port-map/apply-rules")
  @Roles(UserRole.ADMIN)
  @Permissions("routers.manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Re-apply iptables DNAT rules (after reboot etc.)" })
  async applyRules(@Param("id", ParseUUIDPipe) id: string) {
    const portMap = await this.portMappingService.getPortMap(id);
    await this.portMappingService.applyIptablesRules(portMap);
    return { success: true };
  }

  /**
   * Remove iptables rules without deleting the port map.
   * POST /routers/:id/port-map/remove-rules
   */
  @Post(":id/port-map/remove-rules")
  @Roles(UserRole.ADMIN)
  @Permissions("routers.manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove iptables DNAT rules (keep port map in DB)" })
  async removeRules(@Param("id", ParseUUIDPipe) id: string) {
    const portMap = await this.portMappingService.getPortMap(id);
    await this.portMappingService.removeIptablesRules(portMap);
    return { success: true };
  }

  /**
   * TCP ping via WireGuard tunnel (port 22).
   * GET /routers/:id/port-map/test
   */
  @Get(":id/port-map/test")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.view")
  @ApiOperation({
    summary: "TCP reachability test via WireGuard (SSH port 22)",
  })
  testConnection(@Param("id", ParseUUIDPipe) id: string) {
    return this.portMappingService.testConnection(id);
  }

  /**
   * Remove iptables rules AND delete the port map from DB.
   * DELETE /routers/:id/port-map
   */
  @Delete(":id/port-map")
  @Roles(UserRole.ADMIN)
  @Permissions("routers.manage")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove iptables rules + delete port map" })
  deletePortMap(@Param("id", ParseUUIDPipe) id: string) {
    return this.portMappingService.deletePortMap(id);
  }
}

/**
 * Admin-scoped port mapping endpoints.
 * POST /admin/port-mapping/restore-all
 */
@ApiTags("admin-port-mapping")
@Controller({ path: "admin/port-mapping", version: "1" })
@ApiBearerAuth()
export class AdminPortMappingController {
  constructor(private readonly portMappingService: PortMappingService) {}

  /**
   * Re-apply iptables rules for all routers where rulesActive = true.
   * Useful after a VPS reboot if the server auto-start missed some rules.
   */
  @Post("restore-all")
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Re-apply all active iptables DNAT rules (post-reboot recovery)",
  })
  async restoreAll() {
    await this.portMappingService.restoreAllRules();
    return { success: true };
  }
}
