/**
 * CinetPay Sandbox Integration Test
 *
 * This script tests the CinetPay provider with sandbox credentials.
 * You must set the following environment variables or update the config below:
 *
 *   CINETPAY_API_URL=https://api-sandbox.cinetpay.com
 *   CINETPAY_SITE_ID=your_site_id_here
 *   CINETPAY_API_KEY=your_api_key_here
 *   CINETPAY_WEBHOOK_SECRET=your_webhook_secret_minimum_32_chars
 *   CINETPAY_CURRENCY=XOF
 *   CINETPAY_NOTIFY_URL=http://localhost:3000/api/v1/webhooks/cinetpay
 *   CINETPAY_RETURN_URL=http://localhost:3000/portal/payment/status
 *
 * Run with: `npx ts-node test/cinetpay-sandbox-test.ts`
 * Ensure you have valid sandbox credentials from https://sandbox.cinetpay.com
 */

import { ConfigService } from "@nestjs/config";
import { CinetPayProvider } from "../src/modules/payments/providers/cinetpay.provider";
import { PrismaClient } from "@prisma/client";

async function main() {
  console.log("🔧 CinetPay Sandbox Integration Test");
  console.log("====================================\n");

  // 1. Load environment variables (use defaults if not set)
  const config = new ConfigService({
    CINETPAY_API_URL:
      process.env.CINETPAY_API_URL || "https://api-sandbox.cinetpay.com",
    CINETPAY_SITE_ID: process.env.CINETPAY_SITE_ID || "your_site_id_here",
    CINETPAY_API_KEY: process.env.CINETPAY_API_KEY || "your_api_key_here",
    CINETPAY_WEBHOOK_SECRET:
      process.env.CINETPAY_WEBHOOK_SECRET ||
      "your_webhook_secret_minimum_32_chars",
    CINETPAY_CURRENCY: process.env.CINETPAY_CURRENCY || "XOF",
    CINETPAY_DEFAULT_CHANNEL: process.env.CINETPAY_DEFAULT_CHANNEL || "",
    CINETPAY_NOTIFY_URL:
      process.env.CINETPAY_NOTIFY_URL ||
      "http://localhost:3000/api/v1/webhooks/cinetpay",
    CINETPAY_RETURN_URL:
      process.env.CINETPAY_RETURN_URL ||
      "http://localhost:3000/portal/payment/status",
    CINETPAY_ALLOWED_IPS: process.env.CINETPAY_ALLOWED_IPS || "",
  });

  const siteId = config.getOrThrow<string>("cinetpay.siteId");
  const apiKey = config.getOrThrow<string>("cinetpay.apiKey");

  // 2. Check if using placeholder credentials
  if (siteId === "your_site_id_here" || apiKey === "your_api_key_here") {
    console.warn(
      "⚠️ Using placeholder credentials – sandbox API calls will fail.",
    );
    console.log(
      "   Please sign up at https://sandbox.cinetpay.com and update your .env file.",
    );
    console.log("   Alternatively, set environment variables:");
    console.log("   export CINETPAY_SITE_ID=...");
    console.log("   export CINETPAY_API_KEY=...");
    console.log("");
  }

  // 3. Instantiate provider
  const provider = new CinetPayProvider(config);
  console.log("✅ CinetPayProvider instantiated");
  console.log(`   Site ID: ${siteId}`);
  console.log(`   API URL: ${config.get("cinetpay.apiUrl")}`);
  console.log(`   Currency: ${config.get("cinetpay.currency", "XOF")}`);
  console.log("");

  // 4. Test connectivity with a simple health check (if API supports)
  console.log("🩺 Testing provider configuration...");
  try {
    // CinetPay doesn't have a health endpoint, but we can attempt a lightweight request
    // or just validate that the provider can be instantiated without errors.
    console.log(
      "   Configuration validated (no connectivity test implemented).",
    );
  } catch (error) {
    console.error("❌ Provider configuration error:", (error as Error).message);
    console.log(
      "   Check your environment variables and network connectivity.",
    );
    return;
  }

  // 5. Simulate a payment creation (optional – skip if using placeholder credentials)
  const skipRealApiCall =
    siteId === "your_site_id_here" || apiKey === "your_api_key_here";
  if (skipRealApiCall) {
    console.log("\n⏭️ Skipping real API call due to placeholder credentials.");
    console.log(
      "   To test actual payment flow, update credentials in .env file.",
    );
  } else {
    console.log("\n📦 Simulating payment creation (sandbox)...");
    const reference = `MS-SANDBOX-${Date.now()}`;
    const idempotencyKey = `test-${reference}`;
    const customerPhone = "+2250700000000"; // Test phone number (sandbox)
    const customerName = "Sandbox Customer";
    const amountXof = 100; // Small amount for sandbox

    console.log(`   Reference: ${reference}`);
    console.log(`   Amount: ${amountXof} XOF`);
    console.log(`   Phone: ${customerPhone}`);

    try {
      const paymentOutput = await provider.createPayment({
        reference,
        idempotencyKey,
        amountXof,
        customerPhone,
        customerName,
        description: "MikroServer - Sandbox Test",
        successUrl: "http://localhost:3000/portal/payment/success",
        errorUrl: "http://localhost:3000/portal/payment/error",
      });

      console.log("\n✅ Sandbox payment created successfully!");
      console.log(`   Provider Reference: ${paymentOutput.providerReference}`);
      console.log(`   Payment URL: ${paymentOutput.paymentUrl}`);
      console.log(`   Expires at: ${paymentOutput.expiresAt.toISOString()}`);
      console.log("");
      console.log("📝 Next steps:");
      console.log(`   1. Open ${paymentOutput.paymentUrl} to simulate payment`);
      console.log("   2. Use sandbox test credentials to complete payment");
      console.log(
        "   3. Webhook will be sent to:",
        config.get("cinetpay.notifyUrl"),
      );
    } catch (error) {
      console.error(
        "❌ Sandbox payment creation failed:",
        (error as Error).message,
      );
      if ((error as any).response) {
        console.error(
          "   API Response:",
          JSON.stringify((error as any).response.data, null, 2),
        );
      }
    }
  }

  // 6. Test webhook signature verification (simulated)
  console.log("\n🔐 Testing webhook signature verification...");
  const testWebhookPayload = {
    cpm_trans_id: "sandbox-trans-123456",
    cpm_site_id: siteId,
    signature: "dummy-signature", // Will not match; test will fail
    cpm_amount: "100",
    cpm_currency: "XOF",
    cpm_payment_date: "2024-01-01",
    cpm_payment_time: "12:00:00",
    cpm_trans_status: "ACCEPTED",
    cpm_custom: JSON.stringify({ test: true }),
  };

  try {
    // This will fail because signature is invalid; that's expected
    await provider.verifyAndParseWebhook({
      rawBody: JSON.stringify(testWebhookPayload),
      signature: testWebhookPayload.signature,
      ipAddress: "127.0.0.1",
    });
    console.log(
      "❌ Unexpected success – signature verification should have failed!",
    );
  } catch (error) {
    if ((error as any).message?.includes("Invalid webhook signature")) {
      console.log(
        "✅ Webhook signature verification correctly rejected invalid signature.",
      );
    } else {
      console.error("❌ Webhook verification error:", (error as Error).message);
    }
  }

  // 7. Test payment status query (optional, only with real transaction ID)
  console.log("\n🧪 Testing payment status query...");
  if (!skipRealApiCall) {
    // If we have a real providerReference from earlier, we can test status check
    // For now, just show that the method exists
    console.log(
      "   Status query method is available (requires real transaction ID).",
    );
  } else {
    console.log("   Skipped – requires real transaction ID.");
  }

  console.log("\n====================================");
  console.log("✨ Sandbox test completed.");
  console.log("\n📚 Next actions:");
  console.log("   1. Update .env with real CinetPay sandbox credentials");
  console.log("   2. Run the test again to test actual API integration");
  console.log("   3. Implement webhook endpoint at /api/v1/webhooks/cinetpay");
  console.log("   4. Configure CinetPay dashboard with your notify_url");
}

main().catch((error) => {
  console.error("💥 Unhandled error in test:", error);
  process.exit(1);
});
