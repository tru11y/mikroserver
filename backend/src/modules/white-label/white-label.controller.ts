import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  Param,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { WhiteLabelService, UpdateWhiteLabelDto } from "./white-label.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Public } from "../auth/decorators/public.decorator";

@Controller("white-label")
export class WhiteLabelController {
  constructor(private readonly service: WhiteLabelService) {}

  @Get("config")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getMyConfig(@Req() req: any) {
    return this.service.getConfig(req.user.id as string);
  }

  @Patch("config")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async updateMyConfig(@Req() req: any, @Body() dto: UpdateWhiteLabelDto) {
    return this.service.update(
      req.user.id as string,
      dto,
      req.ip as string | undefined,
    );
  }

  // Public endpoint — used by the WiFi portal (no auth required)
  @Public()
  @Get("public/:userId")
  async getPublicConfig(@Param("userId") userId: string) {
    return this.service.getPublicConfig(userId);
  }
}
