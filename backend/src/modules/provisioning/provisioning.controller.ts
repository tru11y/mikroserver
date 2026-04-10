import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  ParseUUIDPipe,
  Res,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { ProvisioningService } from "./provisioning.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { Roles } from "../auth/decorators/roles.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("provisioning")
@Controller({ path: "provisioning", version: "1" })
@ApiBearerAuth()
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Initiate router provisioning (phone-home flow)" })
  start(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      routerName: string;
      location?: string;
      apiUsername: string;
      apiPassword: string;
      publicIp?: string;
      apiPort?: number;
    },
  ) {
    return this.provisioningService.start(user.sub, {
      routerName: body.routerName,
      location: body.location,
      apiUsername: body.apiUsername,
      apiPassword: body.apiPassword,
      publicIp: body.publicIp,
      apiPort: body.apiPort,
    });
  }

  @Post("prepare")
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Prepare browser-based provisioning (generate WG keys, assign IP)",
  })
  prepare(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      routerName: string;
      location?: string;
      apiUsername?: string;
      apiPassword?: string;
      publicIp?: string;
      apiPort?: number;
    },
  ) {
    return this.provisioningService.prepare(
      user.sub,
      body.routerName,
      body.location,
      body.apiUsername,
      body.apiPassword,
      body.publicIp,
      body.apiPort,
    );
  }

  @Post("finalize/:id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      "Finalize provisioning after browser configured the router via REST API",
  })
  finalize(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { routerIdentity: string; hotspotName: string },
  ) {
    return this.provisioningService.finalize(
      id,
      user.sub,
      body.routerIdentity,
      body.hotspotName,
    );
  }

  @Get(":id/qr")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Get bootstrap command as QR code data URL" })
  async getBootstrapQr(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const qrDataUrl = await this.provisioningService.getBootstrapQr(id, user.sub);
    return { data: { qrDataUrl } };
  }

  @Get("scan")
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Scan WireGuard subnet for reachable MikroTik routers (port 8728)",
  })
  scanNetwork() {
    return this.provisioningService.scanNetwork();
  }

  @Get("bootstrap/:token")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Router retrieves WireGuard bootstrap RSC script (no auth)",
  })
  async serveBootstrapScript(
    @Param("token") token: string,
    @Res() reply: FastifyReply,
  ) {
    const rsc = await this.provisioningService.handleBootstrap(token);
    void reply
      .header("Content-Type", "text/plain; charset=utf-8")
      .header(
        "Content-Disposition",
        'attachment; filename="mikroserver-bootstrap.rsc"',
      )
      .send(rsc);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "List provisioning sessions" })
  list(@CurrentUser() user: JwtPayload) {
    return this.provisioningService.listSessions(user.sub);
  }

  @Get(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Get provisioning session status" })
  getStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.provisioningService.getStatus(id, user.sub);
  }
}
