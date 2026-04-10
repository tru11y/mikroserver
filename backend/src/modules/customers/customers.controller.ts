import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { CustomersService } from "./customers.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";

@ApiTags("customers")
@Controller({ path: "customers", version: "1" })
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: "List customer profiles" })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("routerId") routerId?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("search") search?: string,
  ) {
    return this.customersService.findAll(
      routerId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 25,
      search,
      user.sub,
      user.role,
    );
  }

  @Get("stats")
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: "Get customer aggregate stats" })
  getStats(
    @CurrentUser() user: JwtPayload,
    @Query("routerId") routerId?: string,
  ) {
    return this.customersService.getStats(routerId, user.sub, user.role);
  }

  @Get(":id")
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: "Get customer profile" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Update customer profile" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      notes?: string;
    },
  ) {
    return this.customersService.update(id, body);
  }

  @Patch(":id/block")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Block/unblock customer" })
  block(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { isBlocked: boolean },
  ) {
    return this.customersService.block(id, body.isBlocked);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete customer profile" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.customersService.remove(id);
  }
}
