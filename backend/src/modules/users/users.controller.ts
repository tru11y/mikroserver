import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { Permissions } from "../auth/decorators/permissions.decorator";
import {
  ChangeUserRoleDto,
  CreateUserDto,
  ListUsersQueryDto,
  ListUsersPaginatedQueryDto,
  ResetUserPasswordDto,
  UpdateUserAccessDto,
  UpdateUserProfileDto,
} from "./dto/users.dto";

@ApiTags("users")
@Controller({ path: "users", version: "1" })
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @Permissions("users.view")
  @ApiOperation({ summary: "List all users (with optional role filter)" })
  findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query.role);
  }

  @Get("paginated")
  @Roles(UserRole.ADMIN)
  @Permissions("users.view")
  @ApiOperation({ summary: "Paginated user list with search and counts" })
  findAllPaginated(@Query() query: ListUsersPaginatedQueryDto) {
    return this.usersService.findAllPaginated({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      role: query.role,
    });
  }

  @Get("permission-options")
  @Roles(UserRole.ADMIN)
  @Permissions("users.manage")
  @ApiOperation({
    summary: "List available permission profiles and permission catalog",
  })
  permissionOptions() {
    return this.usersService.getPermissionOptions();
  }

  @Get("resellers")
  @Roles(UserRole.ADMIN)
  @Permissions("users.view")
  @ApiOperation({ summary: "List reseller accounts" })
  findResellers() {
    return this.usersService.findResellers();
  }

  @Get(":id")
  @Roles(UserRole.ADMIN)
  @Permissions("users.view")
  @ApiOperation({ summary: "Get user by ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @Permissions("users.manage")
  @ApiOperation({ summary: "Create a user (admin, reseller or viewer)" })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.create(dto, user);
  }

  @Put(":id/profile")
  @Roles(UserRole.ADMIN)
  @Permissions("users.manage")
  @ApiOperation({ summary: "Update the profile details of a managed user" })
  updateProfile(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserProfileDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.updateProfile(id, dto, user);
  }

  @Put(":id/access")
  @Roles(UserRole.ADMIN)
  @Permissions("users.manage")
  @ApiOperation({
    summary: "Update user permission profile or custom permissions",
  })
  updateAccess(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserAccessDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.updateAccess(id, dto, user.sub);
  }

  @Put(":id/password")
  @Roles(UserRole.ADMIN)
  @Permissions("users.manage")
  @ApiOperation({ summary: "Reset the password of a managed user account" })
  resetPassword(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.resetPassword(id, dto.password, user);
  }

  @Post(":id/suspend")
  @Roles(UserRole.ADMIN)
  @Permissions("users.manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Suspend a user account" })
  suspend(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.suspend(id, user.sub);
  }

  @Post(":id/activate")
  @Roles(UserRole.ADMIN)
  @Permissions("users.manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Re-activate a suspended user account" })
  activate(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.activate(id, user.sub);
  }

  @Patch(":id/role")
  @Roles(UserRole.SUPER_ADMIN)
  @Permissions("users.manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Change the role of a user account (SUPER_ADMIN only)",
  })
  changeRole(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ChangeUserRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.changeRole(id, dto.role, user);
  }

  @Post(":id/reset-password-generate")
  @Roles(UserRole.SUPER_ADMIN)
  @Permissions("users.manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Generate a random temp password and reset user account (SUPER_ADMIN only)",
  })
  generateAndResetPassword(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.generateAndResetPassword(id, user);
  }

  @Delete(":id")
  @Roles(UserRole.SUPER_ADMIN)
  @Permissions("users.manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Soft-delete a user account" })
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.softDelete(id, user.sub);
  }
}
