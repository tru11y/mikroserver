import { PaymentProvider, WebhookEventStatus } from "@prisma/client";
import { WebhooksController } from "./webhooks.controller";

describe("WebhooksController", () => {
  const createController = () => {
    const prisma = {
      webhookEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    const queueService = {
      enqueueWebhookProcessing: jest.fn(),
    };
    const waveProvider = {
      verifyAndParseWebhook: jest.fn(),
    };
    const cinetPayProvider = {
      verifyAndParseWebhook: jest.fn(),
    };

    const controller = new WebhooksController(
      prisma as never,
      queueService as never,
      waveProvider as never,
      cinetPayProvider as never,
    );

    return { controller, prisma, queueService, waveProvider };
  };

  it("returns received false for a rejected webhook and skips persistence", async () => {
    const { controller, prisma, queueService, waveProvider } =
      createController();
    waveProvider.verifyAndParseWebhook.mockRejectedValue(
      new Error("Invalid webhook signature"),
    );

    const result = await controller.handleWaveWebhook(
      {
        body: { ok: true },
        ip: "10.0.0.1",
      } as never,
      "bad-signature",
      "1710000000",
      "41.66.47.70",
    );

    expect(result).toEqual({ received: false });
    expect(prisma.webhookEvent.findUnique).not.toHaveBeenCalled();
    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
    expect(queueService.enqueueWebhookProcessing).not.toHaveBeenCalled();
  });

  it("returns early for duplicate webhook events", async () => {
    const { controller, prisma, queueService, waveProvider } =
      createController();
    waveProvider.verifyAndParseWebhook.mockResolvedValue({
      externalEventId: "evt-1",
      externalReference: "checkout-1",
      status: "SUCCESS",
      amountXof: 1000,
      rawPayload: { ok: true },
    });
    prisma.webhookEvent.findUnique.mockResolvedValue({
      id: "webhook-1",
      status: WebhookEventStatus.PROCESSED,
    });

    const result = await controller.handleWaveWebhook(
      {
        body: { ok: true },
        ip: "10.0.0.1",
      } as never,
      "signature",
      "1710000000",
      "41.66.47.70",
    );

    expect(result).toEqual({ received: true });
    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
    expect(queueService.enqueueWebhookProcessing).not.toHaveBeenCalled();
  });

  it("stores and queues a valid webhook with redacted sensitive headers", async () => {
    const { controller, prisma, queueService, waveProvider } =
      createController();
    waveProvider.verifyAndParseWebhook.mockResolvedValue({
      externalEventId: "evt-2",
      externalReference: "checkout-2",
      status: "SUCCESS",
      amountXof: 2500,
      rawPayload: { event: "ok" },
    });
    prisma.webhookEvent.findUnique.mockResolvedValue(null);
    prisma.webhookEvent.create.mockResolvedValue({
      id: "webhook-2",
    });

    const result = await controller.handleWaveWebhook(
      {
        rawBody: Buffer.from('{"event":"ok"}', "utf8"),
        body: { event: "ok" },
        ip: "10.0.0.1",
      } as never,
      "signature",
      "1710000000",
      "41.66.47.70, 10.0.0.1",
    );

    expect(result).toEqual({ received: true });
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
      data: {
        provider: PaymentProvider.WAVE,
        externalEventId: "evt-2",
        status: WebhookEventStatus.RECEIVED,
        rawPayload: { event: "ok" },
        headers: {
          signature: "[REDACTED]",
          timestamp: "1710000000",
          ip: "41.66.47.70",
        },
        ipAddress: "41.66.47.70",
        signature: "[REDACTED]",
        signatureValid: true,
      },
    });
    expect(queueService.enqueueWebhookProcessing).toHaveBeenCalledWith({
      webhookEventId: "webhook-2",
      provider: "WAVE",
    });
  });
});
