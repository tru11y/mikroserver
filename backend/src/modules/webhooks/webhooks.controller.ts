import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { Public } from "../auth/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { QueueService } from "../queue/queue.service";
import { WaveProvider } from "../payments/providers/wave.provider";
import { CinetPayProvider } from "../payments/providers/cinetpay.provider";
import { WebhookEventStatus, PaymentProvider, Prisma } from "@prisma/client";

/**
 * Webhooks Controller
 *
 * ARCHITECTURAL DECISIONS:
 * 1. Fire-and-forget pattern: store raw payload IMMEDIATELY, return 200, process async
 *    - This keeps response time < 50ms regardless of downstream complexity
 *    - Wave will retry if we don't respond within its timeout
 * 2. Raw body preserved intact for HMAC verification
 * 3. Idempotency: duplicate webhooks detected by externalEventId
 * 4. Signature verification happens BEFORE any DB write
 */

@ApiTags("webhooks")
@Controller({ path: "webhooks", version: "1" })
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly waveProvider: WaveProvider,
    private readonly cinetPayProvider: CinetPayProvider,
  ) {}

  @Public()
  @Post("wave")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Wave payment webhook receiver" })
  async handleWaveWebhook(
    @Req() req: FastifyRequest & { rawBody?: Buffer },
    @Headers("x-wave-signature") signature: string,
    @Headers("x-wave-timestamp") timestamp: string,
    @Headers("x-forwarded-for") xForwardedFor: string,
  ): Promise<{ received: boolean }> {
    const ipAddress =
      xForwardedFor?.split(",")[0]?.trim() ?? req.ip ?? "unknown";

    // 1. Ensure we have raw body for HMAC
    const rawBody = req.rawBody?.toString("utf8") ?? JSON.stringify(req.body);

    if (!rawBody) {
      throw new BadRequestException("Empty request body");
    }

    if (!signature) {
      this.logger.warn(`Wave webhook missing signature from ${ipAddress}`);
      throw new BadRequestException("Missing webhook signature");
    }

    // 2. Verify HMAC signature FIRST (reject before any DB write on failure)
    let parsedEvent;
    try {
      parsedEvent = await this.waveProvider.verifyAndParseWebhook({
        rawBody,
        signature,
        timestamp,
        ipAddress,
      });
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "Signature verification failed";
      this.logger.warn(`Wave webhook rejected: ${msg} from ${ipAddress}`);
      // Return 200 to prevent Wave from retrying a legitimately rejected request
      // Log the rejection for security monitoring
      return { received: false };
    }

    // 3. Idempotency check — duplicate webhook detection
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { externalEventId: parsedEvent.externalEventId },
    });

    if (existing) {
      this.logger.log(
        `Duplicate webhook event ${parsedEvent.externalEventId} — already ${existing.status}`,
      );
      return { received: true };
    }

    // 4. Store raw event immediately (< 5ms)
    const storedEvent = await this.prisma.webhookEvent.create({
      data: {
        provider: PaymentProvider.WAVE,
        externalEventId: parsedEvent.externalEventId,
        status: WebhookEventStatus.RECEIVED,
        rawPayload: parsedEvent.rawPayload as Prisma.InputJsonValue,
        headers: {
          signature: "[REDACTED]", // Never store signatures
          timestamp,
          ip: ipAddress,
        },
        ipAddress,
        signature: "[REDACTED]",
        signatureValid: true,
      },
    });

    // 5. Queue async processing — non-blocking
    await this.queueService.enqueueWebhookProcessing({
      webhookEventId: storedEvent.id,
      provider: "WAVE",
    });

    this.logger.log(
      `Wave webhook received and queued: event=${parsedEvent.externalEventId}`,
    );

    return { received: true };
  }

  // ---------------------------------------------------------------------------
  // CinetPay webhook (Orange Money, MTN MoMo, etc.)
  // ---------------------------------------------------------------------------

  @Public()
  @Post("cinetpay")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "CinetPay payment webhook receiver" })
  async handleCinetPayWebhook(
    @Req() req: FastifyRequest & { rawBody?: Buffer },
    @Headers("x-forwarded-for") xForwardedFor: string,
  ): Promise<{ received: boolean }> {
    const ipAddress =
      xForwardedFor?.split(",")[0]?.trim() ?? req.ip ?? "unknown";

    // CinetPay embeds its signature inside the JSON body — rawBody is required
    // for byte-exact HMAC verification (see C1 fix in main.ts).
    const rawBody = req.rawBody?.toString("utf8") ?? JSON.stringify(req.body);

    if (!rawBody) {
      throw new BadRequestException("Empty request body");
    }

    // Verify signature (CinetPay embeds `signature` field inside the payload)
    let parsedEvent;
    try {
      parsedEvent = await this.cinetPayProvider.verifyAndParseWebhook({
        rawBody,
        ipAddress,
      });
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "Signature verification failed";
      this.logger.warn(`CinetPay webhook rejected: ${msg} from ${ipAddress}`);
      return { received: false };
    }

    // Idempotency — deduplicate by CinetPay transaction ID
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { externalEventId: parsedEvent.externalEventId },
    });

    if (existing) {
      this.logger.log(
        `Duplicate CinetPay webhook event ${parsedEvent.externalEventId} — already ${existing.status}`,
      );
      return { received: true };
    }

    // Store raw event immediately (< 5ms)
    const storedEvent = await this.prisma.webhookEvent.create({
      data: {
        provider: PaymentProvider.CINETPAY,
        externalEventId: parsedEvent.externalEventId,
        status: WebhookEventStatus.RECEIVED,
        rawPayload: parsedEvent.rawPayload as Prisma.InputJsonValue,
        headers: {
          signature: "[REDACTED]",
          ip: ipAddress,
        },
        ipAddress,
        signature: "[REDACTED]",
        signatureValid: true,
      },
    });

    // Queue async processing
    await this.queueService.enqueueWebhookProcessing({
      webhookEventId: storedEvent.id,
      provider: "CINETPAY",
    });

    this.logger.log(
      `CinetPay webhook received and queued: event=${parsedEvent.externalEventId}`,
    );

    return { received: true };
  }
}
