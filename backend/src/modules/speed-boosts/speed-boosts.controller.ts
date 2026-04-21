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
import { UserRole } from "@prisma/client";
import {
  CreateBoostTierDto,
  ListBoostsQueryDto,
  PurchaseBoostDto,
  UpdateBoostTierDto,
} from "./dto/speed-boosts.dto";

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
  purchase(@Body() body: PurchaseBoostDto) {
    return this.speedBoostsService.purchaseBoost(body);
  }

  // --- Admin endpoints ---

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "List boosts" })
  list(@CurrentUser() user: JwtPayload, @Query() query: ListBoostsQueryDto) {
    return this.speedBoostsService.listBoosts({
      sessionId: query.sessionId,
      status: query.status,
      page: query.page,
      limit: query.limit,
      requestingUserRole: user.role,
      requestingUserId: user.sub,
    });
  }

  @Post("tiers")
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Create boost tier" })
  createTier(@Body() body: CreateBoostTierDto) {
    return this.speedBoostsService.createTier(body);
  }

  @Patch("tiers/:id")
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Update boost tier" })
  updateTier(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateBoostTierDto,
  ) {
    return this.speedBoostsService.updateTier(id, body);
  }
}
