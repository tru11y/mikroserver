-- AlterTable
ALTER TABLE "users"
ADD COLUMN "permission_profile" VARCHAR(50),
ADD COLUMN "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb;
