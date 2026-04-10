-- Migration: 4 features — Speed Boost, Predictive Churn, Commission Dashboard, Offline Voucher Sync
-- Generated: 2026-04-02

-- New enums (idempotent)
DO $$ BEGIN CREATE TYPE "BoostStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'REVERTED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ChurnRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Extend existing enums
ALTER TYPE "VoucherStatus" ADD VALUE IF NOT EXISTS 'PENDING_OFFLINE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CHURN_RISK';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOST_ACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BOOST_APPLIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BOOST_REVERTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMISSION_PAYOUT_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMISSION_PAYOUT_PROCESSED';

-- Modify Transaction: make plan_id nullable, add boost_tier_id
ALTER TABLE "transactions" ALTER COLUMN "plan_id" DROP NOT NULL;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "boost_tier_id" UUID;

-- New table: boost_tiers
CREATE TABLE IF NOT EXISTS "boost_tiers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "download_kbps" INTEGER NOT NULL,
    "upload_kbps" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "price_xof" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "boost_tiers_pkey" PRIMARY KEY ("id")
);

-- New table: speed_boosts
CREATE TABLE IF NOT EXISTS "speed_boosts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "tier_id" UUID NOT NULL,
    "transaction_id" UUID,
    "router_id" UUID NOT NULL,
    "voucher_username" VARCHAR(50) NOT NULL,
    "status" "BoostStatus" NOT NULL DEFAULT 'PENDING',
    "applied_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "reverted_at" TIMESTAMPTZ,
    "original_rate_limit" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "speed_boosts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "speed_boosts_transaction_id_key" UNIQUE ("transaction_id")
);

-- New table: commission_payouts
CREATE TABLE IF NOT EXISTS "commission_payouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reseller_id" UUID NOT NULL,
    "amount_xof" INTEGER NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,
    "wave_reference" VARCHAR(255),
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "commission_payouts_pkey" PRIMARY KEY ("id")
);

-- New table: churn_scores
CREATE TABLE IF NOT EXISTS "churn_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "risk_level" "ChurnRisk" NOT NULL,
    "prev_risk_level" "ChurnRisk",
    "factors" JSONB NOT NULL,
    "last_calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "churn_scores_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "churn_scores_user_id_key" UNIQUE ("user_id")
);

-- Foreign keys (idempotent)
DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_boost_tier_id_fkey"
    FOREIGN KEY ("boost_tier_id") REFERENCES "boost_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "speed_boosts" ADD CONSTRAINT "speed_boosts_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "speed_boosts" ADD CONSTRAINT "speed_boosts_tier_id_fkey"
    FOREIGN KEY ("tier_id") REFERENCES "boost_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "speed_boosts" ADD CONSTRAINT "speed_boosts_transaction_id_fkey"
    FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_reseller_id_fkey"
    FOREIGN KEY ("reseller_id") REFERENCES "reseller_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "churn_scores" ADD CONSTRAINT "churn_scores_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS "speed_boosts_status_idx" ON "speed_boosts"("status");
CREATE INDEX IF NOT EXISTS "speed_boosts_session_id_idx" ON "speed_boosts"("session_id");
CREATE INDEX IF NOT EXISTS "speed_boosts_expires_at_idx" ON "speed_boosts"("expires_at");
CREATE INDEX IF NOT EXISTS "commission_payouts_reseller_id_idx" ON "commission_payouts"("reseller_id");
CREATE INDEX IF NOT EXISTS "commission_payouts_status_idx" ON "commission_payouts"("status");
