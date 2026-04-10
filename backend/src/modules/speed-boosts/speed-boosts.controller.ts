import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { SpeedBoostsService } from "./speed-boosts.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { Roles } from "../auth/decorators/roles.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { UserRole, BoostStatus } from "@prisma/client";

@ApiTags("speed-boosts")
@Controller({ path: "speed-boosts", version: "1" })
@ApiBearerAuth()
export class SpeedBoostsController {
  constructor(private readonly speedBoostsService: SpeedBoostsService) {}

  // --- Public endpoints (captive portal) ---

  @Get("tiers")
  @Public()
  @ApiOperation({ summary: "List available boost tiers (public)" })
  listTiers() {
    return this.speedBoostsService.listTiers();
  }

  @Post("purchase")
  @Public()
  @ApiOperation({ summary: "Purchase a speed boost (from captive portal)" })
  purchase(
    @Body()
    body: {
      voucherCode: string;
      tierId: string;
      customerPhone: string;
      customerName?: string;
    },
  ) {
    return this.speedBoostsService.purchaseBoost(body);
  }

  // --- Admin endpoints ---

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "List boosts" })
  list(
    @CurrentUser() user: JwtPayload,
    @Query("sessionId") sessionId?: string,
    @Query("status") status?: BoostStatus,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.speedBoostsService.listBoosts({
      sessionId,
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
      requestingUserRole: user.role,
      requestingUserId: user.sub,
    });
  }

  @Post("tiers")
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Create boost tier" })
  createTier(
    @Body()
    body: {
      name: string;
      downloadKbps: number;
      uploadKbps: number;
      durationMinutes: number;
      priceXof: number;
    },
  ) {
    return this.speedBoostsService.createTier(body);
  }

  @Patch("tiers/:id")
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Update boost tier" })
  updateTier(
    @Param("id", ParseUUIDPipe) id: string,
    @Body()
    body: {
      name?: string;
      downloadKbps?: number;
      uploadKbps?: number;
      durationMinutes?: number;
      priceXof?: number;
      isActive?: boolean;
    },
  ) {
    return this.speedBoostsService.updateTier(id, body);
  }
}
