-- Multi-tenant Plan isolation: add owner_id to plans
-- Existing plans (ownerId NULL) are preserved as legacy data.
-- On provisioning, each new operator gets their own plan set with ownerId set.

-- 1. Add owner_id column (nullable to preserve existing rows)
ALTER TABLE "plans" ADD COLUMN "owner_id" UUID;

-- 2. Add FK to users
ALTER TABLE "plans" ADD CONSTRAINT "plans_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Drop old global unique constraint on slug
ALTER TABLE "plans" DROP CONSTRAINT IF EXISTS "plans_slug_key";

-- 4. Add composite unique (slug, owner_id) — allows same slug across operators
CREATE UNIQUE INDEX "plans_slug_owner_id_key" ON "plans"("slug", "owner_id");

-- 5. Index on owner_id for fast tenant scoping
CREATE INDEX "plans_owner_id_idx" ON "plans"("owner_id");
