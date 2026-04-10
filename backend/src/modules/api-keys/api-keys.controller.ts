import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiKeysService } from "./api-keys.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { FastifyRequest } from "fastify";

interface CreateApiKeyBody {
  name: string;
  permissions: string[];
  expiresAt?: string;
}

@Controller("api-keys")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  @Get()
  list(@Req() req: FastifyRequest & { user: JwtPayload }) {
    return this.service.findAll(req.user.sub);
  }

  @Post()
  create(
    @Req() req: FastifyRequest & { user: JwtPayload },
    @Body() dto: CreateApiKeyBody,
  ) {
    return this.service.create(req.user.sub, {
      name: dto.name,
      permissions: dto.permissions,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  @Delete(":id")
  revoke(
    @Param("id") id: string,
    @Req() req: FastifyRequest & { user: JwtPayload },
  ) {
    return this.service.revoke(id, req.user.sub);
  }
}
