-- AlterEnum (idempotent)
DO $$ BEGIN
  ALTER TYPE "ProvisioningStatus" ADD VALUE 'PENDING_BOOTSTRAP';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable: make public_ip optional, add api_password and bootstrap_token
ALTER TABLE "provisioning_sessions" ALTER COLUMN "public_ip" DROP NOT NULL;
ALTER TABLE "provisioning_sessions" ADD COLUMN IF NOT EXISTS "api_password" VARCHAR(255);
ALTER TABLE "provisioning_sessions" ADD COLUMN IF NOT EXISTS "bootstrap_token" VARCHAR(128);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "provisioning_sessions_bootstrap_token_key" ON "provisioning_sessions"("bootstrap_token");
CREATE INDEX IF NOT EXISTS "provisioning_sessions_bootstrap_token_idx" ON "provisioning_sessions"("bootstrap_token");
