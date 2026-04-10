/**
 * Test script to verify the mock payment provider integration.
 *
 * Run with: `npx ts-node test/mock-payment-test.ts`
 * Ensure backend is running (or at least the database is available).
 */

import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { PaymentProviderRegistry } from "../src/modules/payments/payment-provider.factory";
import { MockProvider } from "../src/modules/payments/providers/mock.provider";

async function main() {
  console.log("🔧 Mock Payment Integration Test");
  console.log("====================================\n");

  // 1. Setup ConfigService with default values
  const config = new ConfigService({
    PAYMENT_PROVIDER: "MOCK",
    WAVE_SUCCESS_URL: "http://localhost:3001/payment/success",
    WAVE_ERROR_URL: "http://localhost:3001/payment/error",
    SECURITY_TRANSACTION_EXPIRY_MINUTES: 30,
  });

  // 2. Instantiate MockProvider
  const mockProvider = new MockProvider(config);
  console.log("✅ MockProvider instantiated");

  // 3. Instantiate PaymentProviderRegistry with mock provider (cast to satisfy constructor)
  const prisma = new PrismaClient();
  const registry = new PaymentProviderRegistry(
    mockProvider as any, // WaveProvider
    mockProvider, // MockProvider
    mockProvider as any, // CinetPayProvider
    config,
  );
  console.log("✅ PaymentProviderRegistry ready");

  // 4. Get a plan from database (or create a dummy one)
  let plan;
  try {
    await prisma.$connect();
    console.log("✅ Connected to database");
    plan = await prisma.plan.findFirst({
      where: { deletedAt: null, status: "ACTIVE" },
    });
    if (!plan) {
      console.warn("⚠️ No active plan found, creating a dummy one for test");
      plan = await prisma.plan.create({
        data: {
          name: "Test Plan 1h",
          slug: "test-plan-1h",
          priceXof: 1000,
          durationMinutes: 60,
          status: "ACTIVE",
          description: "Test plan for mock payment",
        },
      });
    }
    console.log(`✅ Using plan: ${plan.name} (${plan.priceXof} XOF)`);
  } catch (error) {
    console.error(
      "❌ Failed to connect to database:",
      (error as Error).message,
    );
    console.log("ℹ️ Skipping database steps, using dummy plan data");
    plan = {
      id: "test-plan-id",
      name: "Test Plan 1h",
      priceXof: 1000,
    };
  }

  // 5. Simulate a payment initiation
  const reference = `MS-TEST-${Date.now()}`;
  const idempotencyKey = "test-idempotency-key";
  const customerPhone = "+2250102030405";
  const customerName = "Test Customer";

  console.log("\n📦 Simulating payment initiation:");
  console.log(`   Reference: ${reference}`);
  console.log(`   Amount: ${plan.priceXof} XOF`);
  console.log(`   Phone: ${customerPhone}`);

  try {
    const paymentOutput = await mockProvider.createPayment({
      reference,
      idempotencyKey,
      amountXof: plan.priceXof,
      customerPhone,
      customerName,
      description: `MikroServer - ${plan.name}`,
      successUrl: config.getOrThrow<string>("WAVE_SUCCESS_URL"),
      errorUrl: config.getOrThrow<string>("WAVE_ERROR_URL"),
    });

    console.log("\n✅ Mock payment created successfully!");
    console.log(`   Provider Reference: ${paymentOutput.providerReference}`);
    console.log(`   Payment URL: ${paymentOutput.paymentUrl}`);
    console.log(`   Expires at: ${paymentOutput.expiresAt.toISOString()}`);

    // 6. Simulate webhook callback (optional) - we'll just log that webhook would be processed
    console.log("\n🔔 Simulating webhook callback...");
    console.log("   (Webhook simulation not implemented in MockProvider)");
    console.log(
      "   In real scenario, the webhook would be called with the providerReference",
    );
  } catch (error) {
    console.error("❌ Payment creation failed:", (error as Error).message);
    console.error((error as Error).stack);
  }

  // 7. Test registry selection
  console.log("\n🧪 Testing PaymentProviderRegistry selection:");
  try {
    const providerFromRegistry = registry.getProvider("MOCK");
    console.log('✅ Registry returns provider for type "MOCK"');
    console.log(`   Provider class: ${providerFromRegistry.constructor.name}`);
  } catch (error) {
    console.error("❌ Registry selection failed:", (error as Error).message);
  }

  console.log("\n====================================");
  console.log("✨ Test completed.");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("💥 Unhandled error in test:", error);
  process.exit(1);
});
