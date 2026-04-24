import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { SaasService } from "./saas.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { Public } from "../auth/decorators/public.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("saas")
@Controller({ path: "saas", version: "1" })
@UseGuards(RolesGuard)
export class SaasController {
  constructor(private readonly saasService: SaasService) {}

  @Get("tiers")
  @Public()
  @ApiOperation({ summary: "List available SaaS tiers (public)" })
  findTiers() {
    return this.saasService.findTiers();
  }

  @Get("subscription")
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Get current operator subscription",
    description:
      "Retourne l'abonnement SaaS de l'opérateur connecté. " +
      "La gestion des abonnements (assignation, résiliation) est réservée au SUPER_ADMIN via /admin/operators/:id/subscription.",
  })
  getSubscription(@CurrentUser() user: JwtPayload) {
    return this.saasService.getOperatorSubscription(user.sub);
  }

  @Get("usage")
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Get current usage against tier limits" })
  getUsage(@CurrentUser() user: JwtPayload) {
    return this.saasService.getUsage(user.sub);
  }
}
