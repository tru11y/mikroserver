import { Controller, Get, Post, Delete, Body } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { SaasService } from "./saas.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { BillingCycle } from "@prisma/client";
import { Public } from "../auth/decorators/public.decorator";

@ApiTags("saas")
@Controller({ path: "saas", version: "1" })
export class SaasController {
  constructor(private readonly saasService: SaasService) {}

  @Get("tiers")
  @Public()
  @ApiOperation({ summary: "List available SaaS tiers" })
  findTiers() {
    return this.saasService.findTiers();
  }

  @Get("subscription")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current operator subscription" })
  getSubscription(@CurrentUser() user: JwtPayload) {
    return this.saasService.getOperatorSubscription(user.sub);
  }

  @Get("usage")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current usage against tier limits" })
  getUsage(@CurrentUser() user: JwtPayload) {
    return this.saasService.getUsage(user.sub);
  }

  @Post("subscribe")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Subscribe to a tier" })
  subscribe(
    @CurrentUser() user: JwtPayload,
    @Body() body: { tierId: string; billingCycle?: BillingCycle },
  ) {
    return this.saasService.subscribe(user.sub, body.tierId, body.billingCycle);
  }

  @Delete("subscription")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Cancel subscription" })
  cancel(@CurrentUser() user: JwtPayload, @Body() body: { reason?: string }) {
    return this.saasService.cancel(user.sub, body.reason);
  }
}
