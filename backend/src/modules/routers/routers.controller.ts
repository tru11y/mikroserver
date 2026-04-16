import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RoutersService } from "./routers.service";
import {
  BulkRouterActionDto,
  CreateHotspotIpBindingDto,
  CreateHotspotUserProfileDto,
  CreateRouterDto,
  ListHotspotUsersQueryDto,
  ListRoutersQueryDto,
  UpdateHotspotIpBindingDto,
  UpdateHotspotUserProfileConfigDto,
  UpdateHotspotUserProfileDto,
  UpdateRouterDto,
} from "./dto/router.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { Roles } from "../auth/decorators/roles.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { UserRole } from "@prisma/client";
import { SaasTierGuard, TierLimit } from "../saas/saas-tier.guard";
import { Public } from "../auth/decorators/public.decorator";

@ApiTags("routers")
@Controller({ path: "routers", version: "1" })
@ApiBearerAuth()
export class RoutersController {
  constructor(private readonly routersService: RoutersService) {}

  @Public()
  @Get("public/:id")
  @ApiOperation({
    summary: "Get minimal public router info for the captive portal",
  })
  findPublicInfo(@Param("id", ParseUUIDPipe) id: string) {
    return this.routersService.findPublicInfo(id);
  }

  @Get()
  @Roles(UserRole.VIEWER)
  @Permissions("routers.view")
  @ApiOperation({ summary: "List all routers" })
  findAll(
    @Query() query: ListRoutersQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.findAll(query, user.sub, user.role);
  }

  @Get(":id")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.view")
  @ApiOperation({ summary: "Get router details" })
  findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.findOne(id, user.sub, user.role);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @Permissions("routers.manage")
  @TierLimit("routers")
  @UseGuards(SaasTierGuard)
  @ApiOperation({ summary: "Add new router" })
  create(@Body() dto: CreateRouterDto, @CurrentUser() user: JwtPayload) {
    return this.routersService.create(dto, user.sub, user.role);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  @Permissions("routers.manage")
  @ApiOperation({ summary: "Update router" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRouterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.update(id, dto, user.sub);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @Permissions("routers.manage")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete router (soft delete)" })
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.remove(id, user.sub);
  }

  @Get(":id/bootstrap")
  @Roles(UserRole.ADMIN)
  @Permissions("routers.manage")
  @ApiOperation({
    summary: "Get WireGuard bootstrap config for a router (provisions on first call)",
  })
  getBootstrap(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.getBootstrap(id, user.sub);
  }

  @Post(":id/health-check")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.health_check")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Manually trigger router health check" })
  healthCheck(@Param("id", ParseUUIDPipe) id: string) {
    return this.routersService.healthCheck(id);
  }

  @Post(":id/sync")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.sync")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Manually sync live hotspot sessions from MikroTik",
  })
  sync(@Param("id", ParseUUIDPipe) id: string) {
    return this.routersService.sync(id);
  }

  @Post("bulk-actions")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Run bulk actions on multiple routers" })
  bulkAction(
    @Body() dto: BulkRouterActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.bulkAction(dto, user.sub);
  }

  @Public()
  @Post(":id/webfig-session")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Get WebFig proxy URL for remote browser access (TCP stream via VPS port 9000+N)",
  })
  webfigSession(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    return this.routersService.getWebfigSession(id, user?.sub, user?.role);
  }

  @Get(":id/live-stats")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.live_stats")
  @ApiOperation({
    summary: "Get live stats from MikroTik (active clients + bandwidth)",
  })
  liveStats(@Param("id", ParseUUIDPipe) id: string) {
    return this.routersService.getLiveStats(id);
  }

  @Get(":id/stats")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.live_stats")
  @ApiOperation({
    summary:
      "Get bandwidth stats per interface + active connections from MikroTik",
  })
  bandwidthStats(@Param("id", ParseUUIDPipe) id: string) {
    return this.routersService.getBandwidthStats(id);
  }

  @Get(":id/hotspot/user-profiles")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.view")
  @ApiOperation({
    summary: "List hotspot user profiles configured on MikroTik",
  })
  hotspotUserProfiles(@Param("id", ParseUUIDPipe) id: string) {
    return this.routersService.getHotspotUserProfiles(id);
  }

  @Post(":id/hotspot/user-profiles")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.hotspot_manage")
  @ApiOperation({ summary: "Create a hotspot user profile on MikroTik" })
  createHotspotUserProfile(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateHotspotUserProfileDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.createHotspotUserProfile(id, dto, user.sub);
  }

  @Patch(":id/hotspot/user-profiles/:profileId")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.hotspot_manage")
  @ApiOperation({ summary: "Update a hotspot user profile on MikroTik" })
  updateHotspotUserProfileConfig(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("profileId") profileId: string,
    @Body() dto: UpdateHotspotUserProfileConfigDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.updateHotspotUserProfileConfig(
      id,
      profileId,
      dto,
      user.sub,
    );
  }

  @Delete(":id/hotspot/user-profiles/:profileId")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.hotspot_manage")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a hotspot user profile on MikroTik" })
  removeHotspotUserProfile(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("profileId") profileId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.removeHotspotUserProfile(
      id,
      profileId,
      user.sub,
    );
  }

  @Get(":id/hotspot/ip-bindings")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.view")
  @ApiOperation({ summary: "List hotspot IP bindings configured on MikroTik" })
  hotspotIpBindings(@Param("id", ParseUUIDPipe) id: string) {
    return this.routersService.getHotspotIpBindings(id);
  }

  @Post(":id/hotspot/ip-bindings")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.hotspot_manage")
  @ApiOperation({ summary: "Create a hotspot IP binding on MikroTik" })
  createHotspotIpBinding(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateHotspotIpBindingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.createHotspotIpBinding(id, dto, user.sub);
  }

  @Patch(":id/hotspot/ip-bindings/:bindingId")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.hotspot_manage")
  @ApiOperation({ summary: "Update a hotspot IP binding on MikroTik" })
  updateHotspotIpBinding(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("bindingId") bindingId: string,
    @Body() dto: UpdateHotspotIpBindingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.updateHotspotIpBinding(
      id,
      bindingId,
      dto,
      user.sub,
    );
  }

  @Delete(":id/hotspot/ip-bindings/:bindingId")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.hotspot_manage")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a hotspot IP binding on MikroTik" })
  removeHotspotIpBinding(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("bindingId") bindingId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.removeHotspotIpBinding(id, bindingId, user.sub);
  }

  @Post(":id/hotspot/ip-bindings/:bindingId/block")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.hotspot_manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Set hotspot IP binding type to blocked" })
  blockHotspotIpBinding(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("bindingId") bindingId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.blockHotspotIpBinding(id, bindingId, user.sub);
  }

  @Post(":id/hotspot/ip-bindings/:bindingId/unblock")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.hotspot_manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Set hotspot IP binding type to regular (unblock)" })
  unblockHotspotIpBinding(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("bindingId") bindingId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.unblockHotspotIpBinding(id, bindingId, user.sub);
  }

  @Post(":id/hotspot/ip-bindings/:bindingId/enable")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.hotspot_manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Enable a hotspot IP binding (disabled=no)" })
  enableHotspotIpBinding(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("bindingId") bindingId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.enableHotspotIpBinding(id, bindingId, user.sub);
  }

  @Post(":id/hotspot/ip-bindings/:bindingId/disable")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.hotspot_manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Disable a hotspot IP binding (disabled=yes)" })
  disableHotspotIpBinding(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("bindingId") bindingId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.disableHotspotIpBinding(id, bindingId, user.sub);
  }

  @Get(":id/hotspot/users")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.view")
  @ApiOperation({
    summary: "List hotspot users (active and inactive) from MikroTik",
  })
  hotspotUsers(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: ListHotspotUsersQueryDto,
  ) {
    return this.routersService.getHotspotUsers(id, query);
  }

  @Patch(":id/hotspot/users/profile")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.hotspot_manage")
  @ApiOperation({
    summary:
      "Update hotspot profile for a RouterOS user, with optional active-session disconnection",
  })
  updateHotspotUserProfile(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateHotspotUserProfileDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.updateHotspotUserProfile(id, dto, user.sub);
  }

  @Post(":id/hotspot/active/disconnect-by-username")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.hotspot_manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Force disconnect a hotspot active session by username",
  })
  disconnectActiveByUsername(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { username: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.disconnectActiveClientByUsername(
      id,
      body.username,
      user.sub,
    );
  }

  @Post(":id/hotspot/active/disconnect-expired")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.hotspot_manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Disconnect all active sessions with expired vouchers",
  })
  disconnectExpiredActive(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.disconnectExpiredActiveClients(id, user.sub);
  }

  @Post(":id/migrate-to/:targetId")
  @Roles(UserRole.VIEWER)
  @Permissions("routers.manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Migrate active vouchers from this router to another router",
  })
  migrateToRouter(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("targetId", ParseUUIDPipe) targetId: string,
    @Body() body: { dryRun?: boolean },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.migrateActiveVouchers(
      id,
      targetId,
      user.sub,
      body.dryRun ?? false,
    );
  }
}
