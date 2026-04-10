import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  IPaymentProvider,
  CreatePaymentInput,
  CreatePaymentOutput,
  VerifyWebhookInput,
  WebhookEvent,
  PaymentStatus,
} from "../interfaces/payment-provider.interface";

/**
 * Mock Payment Provider
 *
 * Simule un paiement réussi instantanément, sans appel externe.
 * Utilisé pour tester le flux complet (transaction → voucher) sans intégrer un vrai provider.
 *
 * CONFIGURATION ENV :
 *   PAYMENT_PROVIDER=mock
 *   MOCK_SUCCESS_RATE=1.0 (toujours succès)
 *   MOCK_DELAY_MS=2000 (délai avant "paiement réussi")
 */
@Injectable()
export class MockProvider implements IPaymentProvider {
  readonly providerName = "MOCK";

  private readonly logger = new Logger(MockProvider.name);
  private readonly successRate: number;
  private readonly delayMs: number;

  constructor(private readonly configService: ConfigService) {
    this.successRate = this.configService.get<number>("mock.successRate", 1.0);
    this.delayMs = this.configService.get<number>("mock.delayMs", 2000);
  }

  // ---------------------------------------------------------------------------
  // Create Payment (simulé)
  // ---------------------------------------------------------------------------

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentOutput> {
    this.logger.log(`Creating mock payment for reference: ${input.reference}`);

    // Simuler un délai réseau
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));

    const success = Math.random() < this.successRate;
    const status = success ? "SUCCESS" : "FAILED";

    // Générer un ID de transaction simulé
    const providerReference = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // URL de "redirection" simulée (pour le frontend, on n'a pas besoin de vrai redirect)
    const successUrl =
      input.successUrl ||
      this.configService.get<string>(
        "mock.successUrl",
        "http://localhost:3000/portal/payment/success",
      );
    const errorUrl =
      input.errorUrl ||
      this.configService.get<string>(
        "mock.errorUrl",
        "http://localhost:3000/portal/payment/error",
      );

    const paymentUrl = success
      ? `${successUrl}?ref=${input.reference}`
      : `${errorUrl}?ref=${input.reference}`;

    this.logger.log(
      `Mock payment ${status}: ref=${input.reference} providerRef=${providerReference}`,
    );

    return {
      providerReference,
      paymentUrl,
      expiresAt,
      rawResponse: {
        simulated: true,
        status,
        amountXof: input.amountXof,
        customerPhone: input.customerPhone,
        reference: input.reference,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Webhook Verification (simulée)
  // ---------------------------------------------------------------------------

  async verifyAndParseWebhook(
    input: VerifyWebhookInput,
  ): Promise<WebhookEvent> {
    // Pour le mock, on accepte tout webhook signé "mock-signature"
    if (input.signature !== "mock-signature") {
      this.logger.warn(
        `Invalid mock webhook signature from IP: ${input.ipAddress}`,
      );
      throw new Error("Invalid mock webhook signature");
    }

    const parsed = JSON.parse(input.rawBody) as any;

    return {
      externalEventId: parsed.id || `mock-event-${Date.now()}`,
      externalReference: parsed.externalReference || parsed.id || "mock-ref",
      status: parsed.status || "SUCCESS",
      amountXof: parsed.amountXof || 0,
      customerPhone: parsed.customerPhone,
      paidAt: parsed.paidAt ? new Date(parsed.paidAt) : new Date(),
      failureReason: parsed.failureReason,
      rawPayload: parsed,
    };
  }

  // ---------------------------------------------------------------------------
  // Payment Status Query (toujours succès pour les refs mock)
  // ---------------------------------------------------------------------------

  async getPaymentStatus(externalReference: string): Promise<PaymentStatus> {
    // Les références mock commencent par "mock-"
    const isSuccess =
      externalReference.startsWith("mock-") &&
      !externalReference.includes("fail");

    return {
      externalReference,
      status: isSuccess ? "SUCCESS" : "FAILED",
      amountXof: 0, // inconnu sans plus de contexte
      paidAt: isSuccess ? new Date() : undefined,
    };
  }

  isAllowedWebhookIp(ip: string): boolean {
    // En mode mock, on autorise toutes les IPs (local dev)
    return true;
  }
}
