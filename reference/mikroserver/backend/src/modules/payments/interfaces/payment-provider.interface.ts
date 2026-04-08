/**
 * Payment Provider Abstraction Layer
 *
 * ARCHITECTURAL DECISION: We use an interface + factory pattern to decouple
 * the business logic from any specific payment provider. This allows us to:
 * 1. Swap providers without touching business code
 * 2. Add Orange Money, MTN MoMo later with zero refactoring
 * 3. Mock providers in tests
 * 4. A/B test providers
 */

export interface CreatePaymentInput {
  reference: string;          // Our internal transaction reference
  idempotencyKey: string;     // For idempotent requests
  amountXof: number;          // Amount in FCFA
  customerPhone: string;      // +225XXXXXXXXXX
  customerName?: string;
  description: string;
  successUrl: string;
  errorUrl: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentOutput {
  providerReference: string;  // Provider's transaction ID
  paymentUrl: string;         // URL to redirect customer
  expiresAt: Date;
  rawResponse: Record<string, unknown>;
}

export interface VerifyWebhookInput {
  rawBody: string;            // Raw request body for HMAC
  signature: string;          // From request header
  timestamp?: string;         // For replay attack prevention
  ipAddress: string;
}

export interface WebhookEvent {
  externalEventId: string;    // Provider's event ID
  externalReference: string;  // Provider's transaction reference
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'EXPIRED';
  amountXof: number;
  customerPhone?: string;
  paidAt?: Date;
  failureReason?: string;
  rawPayload: Record<string, unknown>;
}

export interface PaymentStatus {
  externalReference: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'EXPIRED';
  amountXof: number;
  paidAt?: Date;
}

/**
 * IPaymentProvider — all payment integrations must implement this interface
 */
export interface IPaymentProvider {
  readonly providerName: string;

  /**
   * Create a payment intent and return a URL to redirect the customer
   */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentOutput>;

  /**
   * Verify incoming webhook signature and parse the event
   * @throws Error if signature is invalid
   */
  verifyAndParseWebhook(input: VerifyWebhookInput): Promise<WebhookEvent>;

  /**
   * Query payment status from provider (for reconciliation)
   */
  getPaymentStatus(externalReference: string): Promise<PaymentStatus>;

  /**
   * Check if a given IP is in the provider's known webhook IP list
   */
  isAllowedWebhookIp(ip: string): boolean;
}

export const PAYMENT_PROVIDER_TOKEN = Symbol('PAYMENT_PROVIDER');
