import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { SubscriptionsService } from "./subscriptions.service";
import { AdminService } from "../admin/admin.service";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import {
  ActivateSubscriptionDto,
  RequestUpgradeDto,
} from "../admin/dto/admin.dto";

@ApiTags("subscriptions")
@Controller({ path: "subscriptions", version: "1" })
@UseGuards(RolesGuard)
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly adminService: AdminService,
  ) {}

  @Get("tiers")
  @Public()
  @ApiOperation({ summary: "Grille tarifaire publique" })
  tiers() {
    return this.subscriptionsService.listTiers();
  }

  @Post("request-upgrade")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Demander une mise à niveau d'abonnement" })
  requestUpgrade(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RequestUpgradeDto,
  ) {
    return this.subscriptionsService.requestUpgrade(user.sub, dto);
  }

  @Post(":tenantId/activate")
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Activer l'abonnement d'un tenant (SUPER_ADMIN)" })
  activate(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Body() dto: ActivateSubscriptionDto,
  ) {
    return this.adminService.activateTenantSubscription(
      tenantId,
      dto.periodDays,
    );
  }

  @Post(":tenantId/deactivate")
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: "Désactiver l'abonnement d'un tenant (SUPER_ADMIN)",
  })
  deactivate(@Param("tenantId", ParseUUIDPipe) tenantId: string) {
    return this.adminService.deactivateTenantSubscription(tenantId);
  }
}
