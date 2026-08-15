-- CleanupPaymentProviders
-- 1. Update any existing rows that use removed enum values to MANUAL
UPDATE "transactions" SET "provider" = 'MANUAL' WHERE "provider" IN ('WAVE', 'CINETPAY', 'ORANGE_MONEY', 'MTN_MOMO');

-- 2. Drop the old default before swapping the enum type
--    (PostgreSQL cannot auto-cast a default expressed in the old type)
ALTER TABLE "transactions" ALTER COLUMN "provider" DROP DEFAULT;

-- 3. Swap enum: rename old → create new → cast column → drop old
ALTER TYPE "PaymentProvider" RENAME TO "PaymentProvider_old";
CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL');
ALTER TABLE "transactions" ALTER COLUMN "provider" TYPE "PaymentProvider" USING ("provider"::text::"PaymentProvider");
DROP TYPE "PaymentProvider_old";

-- 4. Re-set the default with the new enum type
ALTER TABLE "transactions" ALTER COLUMN "provider" SET DEFAULT 'MANUAL'::"PaymentProvider";

-- 5. Rename wave_reference to payment_reference in commission_payouts
ALTER TABLE "commission_payouts" RENAME COLUMN "wave_reference" TO "payment_reference";
