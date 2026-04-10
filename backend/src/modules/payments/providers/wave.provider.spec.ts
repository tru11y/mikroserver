import {
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac } from "crypto";
import { WaveProvider } from "./wave.provider";

describe("WaveProvider", () => {
  const createProvider = (overrides?: {
    allowedIps?: string[];
    webhookSecret?: string;
  }) => {
    const configValues = {
      "wave.apiUrl": "https://api.wave.test",
      "wave.apiKey": "wave-api-key",
      "wave.webhookSecret":
        overrides?.webhookSecret ?? "wave-webhook-secret-32-characters",
      "wave.allowedIps": overrides?.allowedIps ?? [],
      "wave.successUrl": "https://app.example.com/payment/success",
      "wave.errorUrl": "https://app.example.com/payment/error",
      "wave.currency": "XOF",
    };

    const configService = {
      get: jest.fn(
        <T>(key: keyof typeof configValues, fallback?: T) =>
          (configValues[key] as T | undefined) ?? fallback,
      ),
    };

    return new WaveProvider(configService as never);
  };

  const buildWebhook = (
    secret: string,
    payload: Record<string, unknown>,
    timestamp = "1710000000",
  ) => {
    const rawBody = JSON.stringify(payload);
    const signature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    return { rawBody, signature, timestamp };
  };

  it("verifies a valid webhook and maps it to the internal event shape", async () => {
    const secret = "wave-webhook-secret-32-characters";
    const provider = createProvider({ webhookSecret: secret });
    const { rawBody, signature } = buildWebhook(secret, {
      id: "evt-1",
      type: "checkout.session.completed",
      data: {
        id: "checkout-1",
        client_reference: "trx-1",
        payment_status: "succeeded",
        amount: "1200",
        currency: "XOF",
        mobile: "+2250700000000",
        when_completed: "2026-03-15T12:00:00.000Z",
      },
    });

    const result = await provider.verifyAndParseWebhook({
      rawBody,
      signature,
      ipAddress: "1.2.3.4",
    });

    expect(result).toMatchObject({
      externalEventId: "evt-1",
      externalReference: "checkout-1",
      status: "SUCCESS",
      amountXof: 1200,
      customerPhone: "+2250700000000",
    });
    expect(result.paidAt).toEqual(new Date("2026-03-15T12:00:00.000Z"));
  });

  it("rejects an invalid webhook signature", async () => {
    const provider = createProvider();

    await expect(
      provider.verifyAndParseWebhook({
        rawBody: JSON.stringify({
          id: "evt-2",
          data: {
            id: "checkout-2",
            client_reference: "trx-2",
            payment_status: "failed",
            amount: "500",
            currency: "XOF",
            mobile: "+2250700000001",
          },
        }),
        signature: "deadbeef",
        ipAddress: "1.2.3.4",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a webhook outside the replay protection window", async () => {
    const secret = "wave-webhook-secret-32-characters";
    const provider = createProvider({ webhookSecret: secret });
    const { rawBody, signature, timestamp } = buildWebhook(secret, {
      id: "evt-3",
      data: {
        id: "checkout-3",
        client_reference: "trx-3",
        payment_status: "processing",
        amount: "800",
        currency: "XOF",
        mobile: "+2250700000002",
      },
    });

    const nowSpy = jest
      .spyOn(Date, "now")
      .mockReturnValue((parseInt(timestamp, 10) + 301) * 1000);

    await expect(
      provider.verifyAndParseWebhook({
        rawBody,
        signature,
        timestamp,
        ipAddress: "1.2.3.4",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    nowSpy.mockRestore();
  });

  it("supports empty allowed IPs in dev mode and filters explicit IP allowlists", () => {
    const providerWithoutAllowlist = createProvider();
    const providerWithAllowlist = createProvider({
      allowedIps: ["41.1.1.1", "41.1.1.2"],
    });

    expect(providerWithoutAllowlist.isAllowedWebhookIp("8.8.8.8")).toBe(true);
    expect(providerWithAllowlist.isAllowedWebhookIp("41.1.1.1")).toBe(true);
    expect(providerWithAllowlist.isAllowedWebhookIp("8.8.8.8")).toBe(false);
  });

  it("stays bootable when Wave is not configured and only fails when invoked", async () => {
    const configService = {
      get: jest.fn(<T>(_key: string, fallback?: T) => fallback),
    };

    const provider = new WaveProvider(configService as never);

    await expect(
      provider.createPayment({
        reference: "trx-boot-safe",
        idempotencyKey: "idem-1",
        amountXof: 1000,
        customerPhone: "+2250700000000",
        description: "Test",
        successUrl: "https://app.example.com/success",
        errorUrl: "https://app.example.com/error",
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
