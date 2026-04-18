import {
  Controller,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { TunnelsService } from "./tunnels.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { Roles } from "../auth/decorators/roles.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("tunnels")
@Controller({ path: "tunnels", version: "1" })
@ApiBearerAuth()
export class TunnelsController {
  constructor(private readonly tunnelsService: TunnelsService) {}

  @Post("allocate")
  @Roles(UserRole.ADMIN)
  @Permissions("routers.manage")
  @ApiOperation({ summary: "Allocate a new WireGuard tunnel for onboarding" })
  allocate(@CurrentUser() user: JwtPayload) {
    return this.tunnelsService.allocate(user.sub);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @Permissions("routers.manage")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke a tunnel and remove WG peer" })
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tunnelsService.remove(id, user.sub);
  }
}
