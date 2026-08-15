-- CleanupPaymentProviders
-- 1. Update any existing rows that use removed enum values to MANUAL
UPDATE "transactions" SET "provider" = 'MANUAL' WHERE "provider" IN ('WAVE', 'CINETPAY', 'ORANGE_MONEY', 'MTN_MOMO');

-- 2. Change default from WAVE to MANUAL
ALTER TABLE "transactions" ALTER COLUMN "provider" SET DEFAULT 'MANUAL';

-- 3. Remove unused enum values
ALTER TYPE "PaymentProvider" RENAME TO "PaymentProvider_old";
CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL');
ALTER TABLE "transactions" ALTER COLUMN "provider" TYPE "PaymentProvider" USING ("provider"::text::"PaymentProvider");
DROP TYPE "PaymentProvider_old";

-- 4. Rename wave_reference to payment_reference in commission_payouts
ALTER TABLE "commission_payouts" RENAME COLUMN "wave_reference" TO "payment_reference";
