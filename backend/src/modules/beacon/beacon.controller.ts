import {
  Controller,
  Post,
  Param,
  Req,
  ParseUUIDPipe,
  HttpCode,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { PrismaService } from "../prisma/prisma.service";
import { Public } from "../auth/decorators/public.decorator";
import { FastifyRequest } from "fastify";
import { RouterStatus } from "@prisma/client";

@ApiTags("beacon")
@Controller({ path: "beacon", version: "1" })
export class BeaconController {
  private readonly logger = new Logger(BeaconController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post(":routerId")
  @HttpCode(204)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Public()
  @ApiOperation({ summary: "Receive health beacon from router (no JWT)" })
  async beacon(
    @Param("routerId", ParseUUIDPipe) routerId: string,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    const router = await this.prisma.router.findUnique({
      where: { id: routerId },
      include: { tunnel: true },
    });
    if (!router) return; // silent — don't leak existence

    // Security: beacon must come from the router's tunnel IP
    const sourceIp = this.extractClientIp(req);
    if (router.tunnel && sourceIp !== router.tunnel.tunnelIp) {
      this.logger.warn(
        `Beacon IP mismatch for router ${routerId}: got ${sourceIp}, expected ${router.tunnel.tunnelIp}`,
      );
      return;
    }

    await this.prisma.router.update({
      where: { id: routerId },
      data: { lastSeenAt: new Date(), status: RouterStatus.ONLINE },
    });
  }

  private extractClientIp(req: FastifyRequest): string {
    // Trust X-Forwarded-For first header (behind nginx/Caddy)
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string") {
      return xff.split(",")[0].trim();
    }
    return req.ip;
  }
}
