-- Promote site and tags from metadata JSON to indexed columns.
-- Eliminates the full-table-scan caused by in-memory post-fetch filtering.

ALTER TABLE "routers" ADD COLUMN IF NOT EXISTS "site" VARCHAR(100);
ALTER TABLE "routers" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}';

-- Backfill site from existing JSON metadata
UPDATE "routers"
SET "site" = LEFT(metadata->>'site', 100)
WHERE metadata IS NOT NULL
  AND metadata->>'site' IS NOT NULL
  AND "site" IS NULL;

-- Backfill tags array from existing JSON metadata
UPDATE "routers"
SET "tags" = ARRAY(
  SELECT jsonb_array_elements_text(metadata->'tags')
)
WHERE metadata IS NOT NULL
  AND metadata->'tags' IS NOT NULL
  AND jsonb_typeof(metadata->'tags') = 'array'
  AND "tags" = '{}';

CREATE INDEX IF NOT EXISTS "routers_site_idx" ON "routers"("site");
