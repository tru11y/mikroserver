-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_CONNECTION', 'SESSION_EXPIRED', 'PAYMENT_RECEIVED', 'ROUTER_OFFLINE', 'ROUTER_ONLINE', 'VOUCHER_EXPIRING', 'SUBSCRIPTION_EXPIRING', 'SECURITY_ALERT', 'LOW_STOCK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ProvisioningStatus" AS ENUM ('PENDING', 'CONNECTING', 'CONFIGURING_WIREGUARD', 'CONFIGURING_HOTSPOT', 'VERIFYING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('PLATFORM_FEE', 'COMMISSION_PAYOUT', 'REFUND', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ROUTER_OWNER_NOTIFY';
ALTER TYPE "AuditAction" ADD VALUE 'WHITE_LABEL_UPDATED';

-- AlterTable
ALTER TABLE "password_reset_tokens" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "routers" ADD COLUMN     "owner_id" UUID,
ADD COLUMN     "public_ip" VARCHAR(45);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "data" JSONB DEFAULT '{}',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "router_id" UUID,
    "session_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" VARCHAR(2000) NOT NULL,
    "p256dh" VARCHAR(255) NOT NULL,
    "auth" VARCHAR(255) NOT NULL,
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provisioning_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "router_name" VARCHAR(100),
    "location" VARCHAR(255),
    "public_ip" VARCHAR(45) NOT NULL,
    "api_port" INTEGER NOT NULL DEFAULT 8728,
    "api_username" VARCHAR(100) NOT NULL,
    "status" "ProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "current_step" VARCHAR(100),
    "step_log" JSONB NOT NULL DEFAULT '[]',
    "router_id" UUID,
    "error" VARCHAR(1000),
    "wg_private_key" VARCHAR(255),
    "wg_public_key" VARCHAR(255),
    "assigned_wg_ip" VARCHAR(15),
    "router_identity" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provisioning_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" UUID NOT NULL,
    "mac_address" VARCHAR(17) NOT NULL,
    "router_id" UUID NOT NULL,
    "last_username" VARCHAR(100),
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "phone" VARCHAR(20),
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    "total_data_bytes" BIGINT NOT NULL DEFAULT 0,
    "total_spent_xof" INTEGER NOT NULL DEFAULT 0,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(1000),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_tiers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "price_xof_monthly" INTEGER NOT NULL,
    "price_xof_yearly" INTEGER,
    "max_routers" INTEGER,
    "max_monthly_tx" INTEGER,
    "max_resellers" INTEGER,
    "features" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tier_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "price_xof" INTEGER NOT NULL,
    "trial_ends_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reseller_configs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_id" UUID,
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "credit_balance" INTEGER NOT NULL DEFAULT 0,
    "total_sales" INTEGER NOT NULL DEFAULT 0,
    "total_commission" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "allowed_routers" JSONB NOT NULL DEFAULT '[]',
    "max_vouchers_day" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reseller_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "number" VARCHAR(50) NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal_xof" INTEGER NOT NULL,
    "tax_xof" INTEGER NOT NULL DEFAULT 0,
    "total_xof" INTEGER NOT NULL,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "notes" VARCHAR(1000),
    "line_items" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "white_label_configs" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "platform_name" VARCHAR(255) NOT NULL DEFAULT 'MikroServer',
    "logo_url" VARCHAR(2000),
    "favicon_url" VARCHAR(2000),
    "primary_color" VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    "accent_color" VARCHAR(7) NOT NULL DEFAULT '#8b5cf6',
    "support_email" VARCHAR(255),
    "support_phone" VARCHAR(30),
    "footer_text" VARCHAR(500),
    "custom_css" VARCHAR(5000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "white_label_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "key_prefix" VARCHAR(12) NOT NULL,
    "permissions" TEXT[],
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "provisioning_sessions_router_id_key" ON "provisioning_sessions"("router_id");

-- CreateIndex
CREATE INDEX "provisioning_sessions_user_id_idx" ON "provisioning_sessions"("user_id");

-- CreateIndex
CREATE INDEX "provisioning_sessions_status_idx" ON "provisioning_sessions"("status");

-- CreateIndex
CREATE INDEX "provisioning_sessions_expires_at_idx" ON "provisioning_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "customer_profiles_router_id_idx" ON "customer_profiles"("router_id");

-- CreateIndex
CREATE INDEX "customer_profiles_last_seen_at_idx" ON "customer_profiles"("last_seen_at");

-- CreateIndex
CREATE INDEX "customer_profiles_mac_address_idx" ON "customer_profiles"("mac_address");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_mac_address_router_id_key" ON "customer_profiles"("mac_address", "router_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_tiers_name_key" ON "saas_tiers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "saas_tiers_slug_key" ON "saas_tiers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "operator_subscriptions_user_id_key" ON "operator_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "operator_subscriptions_status_idx" ON "operator_subscriptions"("status");

-- CreateIndex
CREATE INDEX "operator_subscriptions_end_date_idx" ON "operator_subscriptions"("end_date");

-- CreateIndex
CREATE UNIQUE INDEX "reseller_configs_user_id_key" ON "reseller_configs"("user_id");

-- CreateIndex
CREATE INDEX "reseller_configs_parent_id_idx" ON "reseller_configs"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_user_id_idx" ON "invoices"("user_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "white_label_configs_user_id_key" ON "white_label_configs"("user_id");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_is_active_idx" ON "api_keys"("is_active");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "password_reset_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "transactions_created_at_status_idx" ON "transactions"("created_at", "status");

-- AddForeignKey
ALTER TABLE "routers" ADD CONSTRAINT "routers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_router_id_fkey" FOREIGN KEY ("router_id") REFERENCES "routers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisioning_sessions" ADD CONSTRAINT "provisioning_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisioning_sessions" ADD CONSTRAINT "provisioning_sessions_router_id_fkey" FOREIGN KEY ("router_id") REFERENCES "routers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_router_id_fkey" FOREIGN KEY ("router_id") REFERENCES "routers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_subscriptions" ADD CONSTRAINT "operator_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_subscriptions" ADD CONSTRAINT "operator_subscriptions_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "saas_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_configs" ADD CONSTRAINT "reseller_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_configs" ADD CONSTRAINT "reseller_configs_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "white_label_configs" ADD CONSTRAINT "white_label_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
