import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  IPaymentProvider,
  CreatePaymentInput,
  CreatePaymentOutput,
  VerifyWebhookInput,
  WebhookEvent,
  PaymentStatus,
} from '../interfaces/payment-provider.interface';

/**
 * Wave CI Payment Provider
 *
 * ARCHITECTURAL DECISIONS:
 * 1. HMAC-SHA256 verification with timing-safe comparison (prevents timing attacks)
 * 2. Replay attack prevention via timestamp window (5 minutes)
 * 3. Axios retry with exponential backoff for transient failures
 * 4. All raw responses stored for audit/debugging
 * 5. idempotencyKey sent as header to prevent double-charges on retries
 */

const REPLAY_WINDOW_SECONDS = 300; // 5 minutes

interface WaveCheckoutResponse {
  id: string;
  checkout_status: string;
  client_reference: string;
  payment_status: string;
  wave_launch_url: string;
  when_expires: string;
  amount: string;
  currency: string;
  transaction_id?: string;
}

interface WaveWebhookPayload {
  id: string;
  type: string;
  data: {
    id: string;
    client_reference: string;
    payment_status: string;
    amount: string;
    currency: string;
    mobile: string;
    when_completed?: string;
    error_code?: string;
    error_message?: string;
  };
}

@Injectable()
export class WaveProvider implements IPaymentProvider {
  readonly providerName = 'WAVE';

  private readonly logger = new Logger(WaveProvider.name);
  private readonly httpClient: AxiosInstance;
  private readonly webhookSecret: string;
  private readonly allowedIps: string[];

  constructor(private readonly configService: ConfigService) {
    const apiUrl = this.configService.getOrThrow<string>('wave.apiUrl');
    const apiKey = this.configService.getOrThrow<string>('wave.apiKey');
    this.webhookSecret = this.configService.getOrThrow<string>('wave.webhookSecret');
    this.allowedIps = this.configService.get<string[]>('wave.allowedIps', []);

    this.httpClient = axios.create({
      baseURL: apiUrl,
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Retry on network errors and 5xx — NOT on 4xx (those are our fault)
    axiosRetry(this.httpClient, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return (
          axiosRetry.isNetworkError(error) ||
          axiosRetry.isRetryableError(error) ||
          (error.response?.status !== undefined && error.response.status >= 500)
        );
      },
      onRetry: (retryCount, error) => {
        this.logger.warn(
          `Wave API retry ${retryCount}/3: ${error.message}`,
        );
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Create Payment
  // ---------------------------------------------------------------------------

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentOutput> {
    const successUrl = this.configService.getOrThrow<string>('wave.successUrl');
    const errorUrl = this.configService.getOrThrow<string>('wave.errorUrl');
    const currency = this.configService.get<string>('wave.currency', 'XOF');

    const payload = {
      amount: String(input.amountXof),
      currency,
      client_reference: input.reference,
      success_url: `${successUrl}?ref=${input.reference}`,
      error_url: `${errorUrl}?ref=${input.reference}`,
      restrict_payer_mobile: input.customerPhone || undefined,
    };

    this.logger.log(`Creating Wave payment for reference: ${input.reference}`);

    const response = await this.httpClient.post<WaveCheckoutResponse>(
      '/checkout/sessions',
      payload,
      {
        headers: {
          'Idempotency-Key': input.idempotencyKey,
        },
      },
    );

    const data = response.data;

    this.logger.log(
      `Wave payment created: ${data.id} for ref ${input.reference}`,
    );

    const expiresAt = new Date(data.when_expires);

    return {
      providerReference: data.id,
      paymentUrl: data.wave_launch_url,
      expiresAt,
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }

  // ---------------------------------------------------------------------------
  // Webhook Verification
  // ---------------------------------------------------------------------------

  async verifyAndParseWebhook(input: VerifyWebhookInput): Promise<WebhookEvent> {
    // 1. Verify HMAC signature
    const expectedSig = createHmac('sha256', this.webhookSecret)
      .update(input.rawBody)
      .digest('hex');

    const sigBuffer = Buffer.from(input.signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSig, 'hex');

    // Timing-safe comparison prevents timing oracle attacks
    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      this.logger.warn(
        `Invalid Wave webhook signature from IP: ${input.ipAddress}`,
      );
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // 2. Replay attack prevention via timestamp
    if (input.timestamp) {
      const webhookTime = parseInt(input.timestamp, 10);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const drift = Math.abs(nowSeconds - webhookTime);

      if (drift > REPLAY_WINDOW_SECONDS) {
        this.logger.warn(
          `Webhook replay detected: drift=${drift}s, from=${input.ipAddress}`,
        );
        throw new UnauthorizedException('Webhook timestamp out of acceptable window');
      }
    }

    // 3. Parse payload
    const parsed: WaveWebhookPayload = JSON.parse(input.rawBody) as WaveWebhookPayload;
    const data = parsed.data;

    const status = this.mapWaveStatus(data.payment_status);

    return {
      externalEventId: parsed.id,
      externalReference: data.id,
      status,
      amountXof: parseInt(data.amount, 10),
      customerPhone: data.mobile,
      paidAt: data.when_completed ? new Date(data.when_completed) : undefined,
      failureReason: data.error_message,
      rawPayload: parsed as unknown as Record<string, unknown>,
    };
  }

  // ---------------------------------------------------------------------------
  // Payment Status Query (reconciliation)
  // ---------------------------------------------------------------------------

  async getPaymentStatus(externalReference: string): Promise<PaymentStatus> {
    const response = await this.httpClient.get<WaveCheckoutResponse>(
      `/checkout/sessions/${externalReference}`,
    );

    const data = response.data;
    const status = this.mapWaveStatus(data.payment_status);

    return {
      externalReference: data.id,
      status,
      amountXof: parseInt(data.amount, 10),
      paidAt: status === 'SUCCESS' ? new Date() : undefined,
    };
  }

  isAllowedWebhookIp(ip: string): boolean {
    if (this.allowedIps.length === 0) return true; // Dev mode
    return this.allowedIps.includes(ip);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private mapWaveStatus(
    waveStatus: string,
  ): 'SUCCESS' | 'FAILED' | 'PENDING' | 'EXPIRED' {
    const mapping: Record<string, 'SUCCESS' | 'FAILED' | 'PENDING' | 'EXPIRED'> = {
      processing: 'PENDING',
      pending: 'PENDING',
      succeeded: 'SUCCESS',
      failed: 'FAILED',
      expired: 'EXPIRED',
      cancelled: 'FAILED',
    };

    return mapping[waveStatus.toLowerCase()] ?? 'PENDING';
  }
}
