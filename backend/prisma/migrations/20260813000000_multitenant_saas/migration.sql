-- Multi-tenant SaaS retrofit

CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

CREATE TABLE "tenants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(255) NOT NULL,
  "slug" VARCHAR(255) NOT NULL,
  "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE INDEX "tenants_status_idx" ON "tenants"("status");
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

ALTER TYPE "UserRole" ADD VALUE 'OWNER';
ALTER TYPE "UserRole" ADD VALUE 'MEMBER';

ALTER TABLE "users"
  ALTER COLUMN "password_hash" DROP NOT NULL,
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "google_id" VARCHAR(255),
  ADD COLUMN "country" VARCHAR(10),
  ADD COLUMN "notifications_enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: give each existing ADMIN/SUPER_ADMIN user their own tenant so
-- existing accounts keep working under the new tenant-scoped model.
INSERT INTO "tenants" ("id", "name", "slug", "status", "updated_at")
SELECT gen_random_uuid(), COALESCE(NULLIF(TRIM(u."first_name" || ' ' || u."last_name"), ''), u."email"),
       'tenant-' || substr(u."id"::text, 1, 8), 'ACTIVE', CURRENT_TIMESTAMP
FROM "users" u
WHERE u."role" IN ('ADMIN', 'SUPER_ADMIN') AND u."deleted_at" IS NULL;

UPDATE "users" u
SET "tenant_id" = t."id"
FROM "tenants" t
WHERE t."slug" = 'tenant-' || substr(u."id"::text, 1, 8)
  AND u."role" IN ('ADMIN', 'SUPER_ADMIN') AND u."deleted_at" IS NULL;
