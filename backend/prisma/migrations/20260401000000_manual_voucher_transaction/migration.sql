-- Add MANUAL to PaymentProvider enum
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'MANUAL';

-- Make customer_phone nullable on transactions
ALTER TABLE "transactions" ALTER COLUMN "customer_phone" DROP NOT NULL;
