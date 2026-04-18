import {
  Controller,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { HotspotSetupService } from "./hotspot-setup.service";
import { ConfigureHotspotDto } from "./dto/configure-hotspot.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { Roles } from "../auth/decorators/roles.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("hotspot-setup")
@Controller({ path: "routers", version: "1" })
@ApiBearerAuth()
export class HotspotSetupController {
  constructor(private readonly hotspotSetup: HotspotSetupService) {}

  @Post(":id/hotspot/setup")
  @Roles(UserRole.ADMIN)
  @Permissions("routers.manage")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Auto-configure hotspot on router via tunnel",
  })
  configure(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ConfigureHotspotDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.hotspotSetup.configure(id, user.sub, dto);
  }
}
