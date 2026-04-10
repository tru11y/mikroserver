import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyRequest, FastifyReply } from "fastify";

/**
 * Webhook IP Allowlist Middleware
 *
 * Only allows requests from Wave's known webhook IP ranges.
 * This is a defense-in-depth measure on top of HMAC verification.
 * If WAVE_ALLOWED_IPS is empty, all IPs are permitted (dev only).
 */
@Injectable()
export class WebhookIpAllowlistMiddleware implements NestMiddleware {
  private readonly logger = new Logger(WebhookIpAllowlistMiddleware.name);
  private readonly allowedIps: string[];

  constructor(private readonly configService: ConfigService) {
    this.allowedIps = this.configService.get<string[]>(
      "security.waveAllowedIps",
      [],
    );
  }

  use(
    req: FastifyRequest["raw"] & { ip?: string; ips?: string[] },
    _res: FastifyReply["raw"],
    next: () => void,
  ): void {
    // If no allowlist configured — warn and pass (development mode)
    if (this.allowedIps.length === 0) {
      this.logger.warn(
        "Webhook IP allowlist is empty — all IPs permitted (dev mode only)",
      );
      next();
      return;
    }

    const clientIp = req.ips?.[0] ?? req.ip ?? "";

    if (!this.allowedIps.includes(clientIp)) {
      this.logger.warn(
        `Webhook request rejected from unauthorized IP: ${clientIp}`,
      );
      throw new ForbiddenException("Unauthorized webhook source");
    }

    next();
  }
}
