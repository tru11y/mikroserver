-- =============================================================================
-- Migration: Add Subscriptions and IP Bindings
-- =============================================================================

-- Create SubscriptionStatus enum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PENDING', 'CANCELLED', 'EXPIRED', 'SUSPENDED');

-- Create PaymentMethod enum (extended from PaymentProvider)
CREATE TYPE "PaymentMethod" AS ENUM ('WAVE', 'ORANGE_MONEY', 'MTN_MOMO', 'CINETPAY', 'MANUAL');

-- Create Subscriptions table
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "voucher_id" UUID UNIQUE,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "price_xof" INTEGER NOT NULL,
    "payment_method" "PaymentMethod",
    "last_billed_at" TIMESTAMP(3),
    "next_billing_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- Create IpBindings table
CREATE TABLE "ip_bindings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "voucher_id" UUID NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "subnet_mask" VARCHAR(45),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ip_bindings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ip_bindings_voucher_id_ip_address_key" UNIQUE ("voucher_id", "ip_address")
);

-- Add columns to users table for subscriptions
ALTER TABLE "users" 
ADD COLUMN "customer_id" VARCHAR(100) UNIQUE,
ADD COLUMN "current_subscription_id" UUID UNIQUE,
ADD COLUMN "default_payment_method" "PaymentMethod",
ADD COLUMN "balance_xof" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_payment_at" TIMESTAMP(3);

-- Create indexes for performance
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX "subscriptions_end_date_idx" ON "subscriptions"("end_date");
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");
CREATE INDEX "subscriptions_voucher_id_idx" ON "subscriptions"("voucher_id");

CREATE INDEX "ip_bindings_voucher_id_idx" ON "ip_bindings"("voucher_id");
CREATE INDEX "ip_bindings_ip_address_idx" ON "ip_bindings"("ip_address");
CREATE INDEX "ip_bindings_is_active_idx" ON "ip_bindings"("is_active");

CREATE INDEX "users_current_subscription_id_idx" ON "users"("current_subscription_id");
CREATE INDEX "users_customer_id_idx" ON "users"("customer_id");

-- Add foreign key constraints
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ip_bindings" ADD CONSTRAINT "ip_bindings_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD CONSTRAINT "users_current_subscription_id_fkey" FOREIGN KEY ("current_subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add comments for documentation
COMMENT ON TABLE "subscriptions" IS 'User subscriptions to plans (recurring or one-time)';
COMMENT ON TABLE "ip_bindings" IS 'IP address restrictions for voucher access';
COMMENT ON COLUMN "users"."customer_id" IS 'External customer identifier (e.g., from payment provider)';
COMMENT ON COLUMN "users"."balance_xof" IS 'Account balance in XOF (FCFA)';
COMMENT ON COLUMN "ip_bindings"."subnet_mask" IS 'Optional subnet mask for IP ranges (e.g., /24)';