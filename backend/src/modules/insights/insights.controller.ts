import { Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { InsightsService } from "./insights.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("insights")
@Controller({ path: "insights", version: "1" })
@ApiBearerAuth()
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get("churn-scores")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "List churn risk scores" })
  listScores(@CurrentUser() user: JwtPayload) {
    return this.insightsService.getChurnScores(user.role, user.sub);
  }

  @Get("churn-scores/me")
  @ApiOperation({ summary: "Get my churn risk score" })
  myScore(@CurrentUser() user: JwtPayload) {
    return this.insightsService.getChurnScore(user.sub);
  }

  @Get("churn-scores/:userId")
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: "Get churn score for specific operator (super admin)",
  })
  getScore(@Param("userId", ParseUUIDPipe) userId: string) {
    return this.insightsService.getChurnScore(userId);
  }

  @Post("churn-scores/recalculate")
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Trigger full churn score recalculation" })
  recalculate() {
    return this.insightsService.recalculateAllChurnScores();
  }

  @Post("churn-scores/me/recalculate")
  @ApiOperation({ summary: "Recalculate my own churn score" })
  recalculateMine(@CurrentUser() user: JwtPayload) {
    return this.insightsService.calculateAndSaveChurnScore(user.sub);
  }
}
