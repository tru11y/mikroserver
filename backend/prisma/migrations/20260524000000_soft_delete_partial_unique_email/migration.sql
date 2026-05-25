-- Fix: partial unique indexes so soft-deleted users don't block re-registration
-- with the same email or phone number.
--
-- Prisma's @unique generates a standard unique constraint (no WHERE clause).
-- We drop those and replace them with partial unique indexes that only apply
-- to non-deleted rows (deleted_at IS NULL).

-- Drop the Prisma-generated full unique constraints
DROP INDEX IF EXISTS "users_email_key";
DROP INDEX IF EXISTS "users_phone_key";

-- Create partial unique indexes: uniqueness only enforced for active (non-deleted) users
CREATE UNIQUE INDEX "users_email_active_unique"
  ON "users" (email)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX "users_phone_active_unique"
  ON "users" (phone)
  WHERE deleted_at IS NULL AND phone IS NOT NULL;
