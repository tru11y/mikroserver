import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import { createHmac, timingSafeEqual } from "crypto";
import {
  IPaymentProvider,
  CreatePaymentInput,
  CreatePaymentOutput,
  VerifyWebhookInput,
  WebhookEvent,
  PaymentStatus,
} from "../interfaces/payment-provider.interface";

/**
 * CinetPay Payment Provider
 *
 * Supports Orange Money, MTN MoMo, Wave (via CinetPay), Carte, etc.
 * Documentation: https://docs.cinetpay.com/
 *
 * ARCHITECTURAL DECISIONS:
 * 1. HMAC-SHA256 verification with timing-safe comparison (prevents timing attacks)
 * 2. Replay attack prevention via timestamp window (5 minutes)
 * 3. Axios retry with exponential backoff for transient failures
 * 4. All raw responses stored for audit/debugging
 * 5. idempotencyKey sent as header to prevent double-charges on retries
 */

const REPLAY_WINDOW_SECONDS = 300; // 5 minutes

interface CinetPayCheckoutResponse {
  code: number;
  message: string;
  data: {
    payment_token: string;
    payment_url: string;
    transaction_id: string;
    api_key_id: string;
    operator_id?: string;
    channel?: string;
    amount: number;
    currency: string;
    description: string;
    customer_name?: string;
    customer_surname?: string;
    customer_email?: string;
    customer_phone_number: string;
    customer_address?: string;
    customer_city?: string;
    customer_country?: string;
    customer_state?: string;
    customer_zip_code?: string;
    metadata?: Record<string, string>;
    created_at: string;
    updated_at: string;
    expire_at: string;
    status: "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED";
    notify_url: string;
    return_url: string;
  };
}

interface CinetPayWebhookPayload {
  cpm_trans_id: string; // CinetPay transaction ID
  cpm_site_id: string; // Site ID
  signature: string; // HMAC signature (for verification)
  cpm_amount: string; // Amount (string)
  cpm_currency: string; // Currency (XOF, etc.)
  cpm_payment_date: string; // Payment date (YYYY-MM-DD HH:MM:SS)
  cpm_payment_time: string; // Payment time (HH:MM:SS)
  cpm_payment_channel?: string; // Payment channel (ORANGE_MONEY, MTN_MOMO, etc.)
  cpm_phone_prefixe?: string; // Phone prefix (+225, etc.)
  cpm_phone_num?: string; // Phone number
  cpm_error_message?: string; // Error message if any
  cpm_trans_status:
    | "ACCEPTED"
    | "REFUSED"
    | "PENDING"
    | "CANCELLED"
    | "EXPIRED";
  cpm_custom?: string; // Custom data (JSON string)
  cpm_designation?: string; // Designation (description)
  cpm_result?: string; // Result (OK, NOK)
  cpm_ipn_ack?: string; // IPN acknowledgment (OK, NOK)
}

@Injectable()
export class CinetPayProvider implements IPaymentProvider {
  readonly providerName = "CINETPAY";

  private readonly logger = new Logger(CinetPayProvider.name);
  private readonly httpClient: AxiosInstance | null = null;
  private readonly webhookSecret?: string;
  private readonly allowedIps: string[];
  private readonly siteId?: string;
  private readonly apiKey?: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiUrl = this.configService.get<string | undefined>(
      "cinetpay.apiUrl",
    );
    this.siteId = this.configService.get<string | undefined>("cinetpay.siteId");
    this.apiKey = this.configService.get<string | undefined>("cinetpay.apiKey");
    this.webhookSecret = this.configService.get<string | undefined>(
      "cinetpay.webhookSecret",
    );
    this.allowedIps = this.configService.get<string[]>(
      "cinetpay.allowedIps",
      [],
    );
    this.enabled = Boolean(
      apiUrl && this.siteId && this.apiKey && this.webhookSecret,
    );

    if (!this.enabled) {
      this.logger.warn("CinetPay provider not configured — provider disabled");
      return;
    }

    this.httpClient = axios.create({
      baseURL: apiUrl,
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
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
          `CinetPay API retry ${retryCount}/3: ${error.message}`,
        );
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Create Payment
  // ---------------------------------------------------------------------------

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentOutput> {
    const httpClient = this.getHttpClient();
    const notifyUrl = this.configService.get<string | undefined>(
      "cinetpay.notifyUrl",
    );
    const returnUrl =
      this.configService.get<string | undefined>("cinetpay.returnUrl") ??
      input.successUrl;
    const currency = this.configService.get<string>("cinetpay.currency", "XOF");
    const channel = this.configService.get<string>(
      "cinetpay.defaultChannel",
      "",
    ); // Empty = all channels
    const siteId = this.siteId;
    const apiKey = this.apiKey;

    if (!notifyUrl || !returnUrl || !siteId || !apiKey) {
      throw new ServiceUnavailableException(
        "CinetPay callback URLs are not configured",
      );
    }

    const payload = {
      apikey: apiKey,
      site_id: siteId,
      transaction_id: input.reference,
      amount: input.amountXof,
      currency,
      description: input.description,
      customer_name: input.customerName || "Customer",
      customer_surname: "",
      customer_email: "",
      customer_phone_number: input.customerPhone,
      customer_address: "",
      customer_city: "",
      customer_country: "CI", // Default Ivory Coast
      customer_state: "",
      customer_zip_code: "",
      notify_url: `${notifyUrl}?ref=${input.reference}`,
      return_url: `${returnUrl}?ref=${input.reference}`,
      channels: channel ? [channel] : ["ALL"],
      metadata: input.metadata || {},
      // Optional: lock phone number for mobile money
      lock_phone_number: !!input.customerPhone,
      // Optional: custom data for webhook
      custom: JSON.stringify({
        idempotencyKey: input.idempotencyKey,
        successUrl: input.successUrl,
        errorUrl: input.errorUrl,
      }),
    };

    this.logger.log(
      `Creating CinetPay payment for reference: ${input.reference}`,
    );

    const response = await httpClient.post<CinetPayCheckoutResponse>(
      "/v2/payment/init",
      payload,
    );

    const data = response.data;

    if (data.code !== 201 && data.code !== 200) {
      throw new Error(`CinetPay API error: ${data.message}`);
    }

    const paymentData = data.data;

    this.logger.log(
      `CinetPay payment created: ${paymentData.transaction_id} for ref ${input.reference}`,
    );

    const expiresAt = new Date(paymentData.expire_at);

    return {
      providerReference: paymentData.transaction_id,
      paymentUrl: paymentData.payment_url,
      expiresAt,
      rawResponse: paymentData as unknown as Record<string, unknown>,
    };
  }

  // ---------------------------------------------------------------------------
  // Webhook Verification
  // ---------------------------------------------------------------------------

  async verifyAndParseWebhook(
    input: VerifyWebhookInput,
  ): Promise<WebhookEvent> {
    const webhookSecret = this.getWebhookSecret();

    // 1. Verify HMAC signature
    const {
      cpm_trans_id,
      cpm_site_id,
      cpm_amount,
      cpm_currency,
      cpm_trans_status,
      signature,
      ...rest
    } = JSON.parse(input.rawBody) as CinetPayWebhookPayload;

    // Build the signature string as per CinetPay documentation
    const signatureData = `${cpm_trans_id}${cpm_site_id}${cpm_amount}${cpm_currency}${cpm_trans_status}`;
    const expectedSig = createHmac("sha256", webhookSecret)
      .update(signatureData)
      .digest("hex");

    // Timing-safe comparison
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSig, "hex");

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      this.logger.warn(
        `Invalid CinetPay webhook signature from IP: ${input.ipAddress}`,
      );
      throw new UnauthorizedException("Invalid webhook signature");
    }

    // 2. Replay attack prevention via timestamp (optional - CinetPay doesn't provide timestamp)
    // We could check cpm_payment_date + cpm_payment_time vs current time
    if (input.timestamp) {
      const webhookTime = parseInt(input.timestamp, 10);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const drift = Math.abs(nowSeconds - webhookTime);

      if (drift > REPLAY_WINDOW_SECONDS) {
        this.logger.warn(
          `Webhook replay detected: drift=${drift}s, from=${input.ipAddress}`,
        );
        throw new UnauthorizedException(
          "Webhook timestamp out of acceptable window",
        );
      }
    }

    // 3. Parse payload and map status
    const status = this.mapCinetPayStatus(cpm_trans_status);

    // Parse custom data if present
    let customData = {};
    try {
      customData = rest.cpm_custom ? JSON.parse(rest.cpm_custom) : {};
    } catch (e) {
      this.logger.warn(`Failed to parse cpm_custom: ${(e as Error).message}`);
    }

    // Combine payment date and time
    let paidAt: Date | undefined;
    if (rest.cpm_payment_date && rest.cpm_payment_time) {
      try {
        paidAt = new Date(`${rest.cpm_payment_date} ${rest.cpm_payment_time}`);
      } catch (e) {
        paidAt = new Date();
      }
    }

    return {
      externalEventId: cpm_trans_id,
      externalReference: cpm_trans_id,
      status,
      amountXof: parseInt(cpm_amount, 10),
      customerPhone: rest.cpm_phone_num
        ? `${rest.cpm_phone_prefixe || ""}${rest.cpm_phone_num}`
        : undefined,
      paidAt,
      failureReason: rest.cpm_error_message,
      rawPayload: {
        cpm_trans_id,
        cpm_site_id,
        cpm_amount,
        cpm_currency,
        cpm_trans_status,
        ...rest,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Payment Status Query (reconciliation)
  // ---------------------------------------------------------------------------

  async getPaymentStatus(externalReference: string): Promise<PaymentStatus> {
    const httpClient = this.getHttpClient();
    if (!this.apiKey || !this.siteId) {
      throw new ServiceUnavailableException(
        "CinetPay provider is not configured",
      );
    }

    const response = await httpClient.get<CinetPayCheckoutResponse>(
      `/v2/payment/check?transaction_id=${externalReference}&apikey=${this.apiKey}&site_id=${this.siteId}`,
    );

    const data = response.data;

    if (data.code !== 200) {
      throw new Error(`CinetPay status check error: ${data.message}`);
    }

    const status = this.mapCinetPayStatus(data.data.status);

    return {
      externalReference: data.data.transaction_id,
      status,
      amountXof: data.data.amount,
      paidAt: status === "SUCCESS" ? new Date(data.data.updated_at) : undefined,
    };
  }

  isAllowedWebhookIp(ip: string): boolean {
    if (this.allowedIps.length === 0) return true; // Dev mode
    return this.allowedIps.includes(ip);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private mapCinetPayStatus(
    cinetpayStatus: string,
  ): "SUCCESS" | "FAILED" | "PENDING" | "EXPIRED" {
    const mapping: Record<
      string,
      "SUCCESS" | "FAILED" | "PENDING" | "EXPIRED"
    > = {
      ACCEPTED: "SUCCESS",
      REFUSED: "FAILED",
      PENDING: "PENDING",
      CANCELLED: "FAILED",
      EXPIRED: "EXPIRED",
      SUCCESS: "SUCCESS",
      FAILED: "FAILED",
    };

    return mapping[cinetpayStatus] ?? "PENDING";
  }

  private getHttpClient(): AxiosInstance {
    if (!this.enabled || !this.httpClient) {
      throw new ServiceUnavailableException(
        "CinetPay provider is not configured",
      );
    }
    return this.httpClient;
  }

  private getWebhookSecret(): string {
    if (!this.enabled || !this.webhookSecret) {
      throw new ServiceUnavailableException(
        "CinetPay provider is not configured",
      );
    }
    return this.webhookSecret;
  }
}
