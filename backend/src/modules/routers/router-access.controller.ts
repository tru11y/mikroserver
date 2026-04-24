import {
  Controller,
  Get,
  Put,
  All,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
  Res,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import * as http from "http";
import { RouterAccessService } from "./router-access.service";
import { UpdateAccessDto } from "./dto/router-access.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { Roles } from "../auth/decorators/roles.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { UserRole } from "@prisma/client";
import type { FastifyRequest, FastifyReply } from "fastify";

@ApiTags("router-access")
@Controller({ path: "routers", version: "1" })
@ApiBearerAuth()
export class RouterAccessController {
  constructor(private readonly routerAccessService: RouterAccessService) {}

  @Get(":id/access")
  @Roles(UserRole.ADMIN)
  @Permissions("routers.manage")
  @ApiOperation({ summary: "Get router remote access credentials" })
  getAccessCredentials(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routerAccessService.getAccessCredentials(
      id,
      user.sub,
      user.role,
    );
  }

  @Put(":id/access")
  @Roles(UserRole.ADMIN)
  @Permissions("routers.manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update router remote access credentials" })
  updateAccessCredentials(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccessDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routerAccessService.updateAccessCredentials(
      id,
      dto,
      user.sub,
      user.role,
    );
  }

  @Get(":id/access/test")
  @Roles(UserRole.ADMIN)
  @Permissions("routers.manage")
  @ApiOperation({
    summary: "Test TCP reachability of router SSH port (3s timeout)",
  })
  testConnection(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routerAccessService.testConnection(id, user.sub, user.role);
  }

  /**
   * HTTP proxy pass-through to WebFig running on the router's VPN IP.
   * Avoids CORS issues: browser hits /api/v1/routers/:id/webfig/* and the
   * VPS forwards the request over the WireGuard tunnel.
   *
   * Path parameter wildcard captured as `0` in Fastify — we reconstruct
   * the full sub-path from the raw URL.
   */
  @All(":id/webfig/*")
  @Roles(UserRole.ADMIN)
  @Permissions("routers.manage")
  @ApiOperation({
    summary: "Proxy HTTP requests to the router WebFig interface",
  })
  async proxyWebfig(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const { wireguardIp, webfigPort } =
      await this.routerAccessService.getRouterForProxy(id);

    // Extract the sub-path after /webfig
    const rawUrl: string = (req.raw as { url?: string }).url ?? req.url ?? "/";
    const webfigIdx = rawUrl.indexOf("/webfig");
    const subPath =
      webfigIdx >= 0 ? rawUrl.slice(webfigIdx + "/webfig".length) || "/" : "/";

    const options: http.RequestOptions = {
      hostname: wireguardIp,
      port: webfigPort,
      path: subPath,
      method: req.method,
      headers: {
        ...(req.headers as http.OutgoingHttpHeaders),
        host: `${wireguardIp}:${webfigPort}`,
        // Strip hop-by-hop headers
        connection: "close",
      },
    };
    delete (options.headers as Record<string, unknown>)["transfer-encoding"];

    await new Promise<void>((resolve) => {
      const proxyReq = http.request(options, (proxyRes) => {
        const statusCode = proxyRes.statusCode ?? 200;
        const headers = proxyRes.headers;

        // copy response headers (skip hop-by-hop)
        for (const [key, val] of Object.entries(headers)) {
          if (["connection", "transfer-encoding", "keep-alive"].includes(key))
            continue;
          if (val !== undefined) reply.header(key, val as string);
        }

        reply.status(statusCode);
        reply.send(proxyRes);
        resolve();
      });

      proxyReq.once("error", (err) => {
        this.logger.error(`WebFig proxy error for ${id}: ${err.message}`);
        reply
          .status(502)
          .send({ message: "WebFig injoignable", error: err.message });
        resolve();
      });

      // Pipe request body for POST/PUT/PATCH
      if (["POST", "PUT", "PATCH"].includes(req.method?.toUpperCase() ?? "")) {
        req.raw.pipe(proxyReq);
      } else {
        proxyReq.end();
      }
    });
  }

  private readonly logger = new Logger(RouterAccessController.name);
}
