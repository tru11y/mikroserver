-- V11: MikroTicket-style router provisioning model.
--
-- Security principle: the router WireGuard PRIVATE key is NEVER persisted.
-- It is generated at provisioning time, returned once in the HTTP response,
-- injected into the RouterOS script, then forgotten. Only wg_public_key is
-- stored. We therefore DROP the transient encrypted private-key column.
ALTER TABLE routers DROP COLUMN IF EXISTS wg_private_key_enc;

-- DNAT port block exposed on the VPS for this router's management planes:
--   base+0 = WebFig (80), base+1 = Winbox (8291), base+2 = SSH (22).
ALTER TABLE routers ADD COLUMN dnat_port_base INT;
-- When the provisioning script was (re)generated.
ALTER TABLE routers ADD COLUMN provisioned_at TIMESTAMPTZ;

-- Backfill existing rows: assign sequential 10-port blocks from 19000 and
-- treat already-onboarded routers as provisioned at their creation time.
WITH numbered AS (
    SELECT id, (row_number() OVER (ORDER BY created_at) - 1) AS n
    FROM routers
)
UPDATE routers r
SET dnat_port_base = 19000 + numbered.n * 10,
    provisioned_at  = r.created_at
FROM numbered
WHERE r.id = numbered.id;

ALTER TABLE routers ALTER COLUMN dnat_port_base SET NOT NULL;

-- Status vocabulary migration: OFFLINE/ONLINE/DEGRADED -> PROVISIONING/ACTIVE/OFFLINE/REVOKED.
ALTER TABLE routers DROP CONSTRAINT IF EXISTS routers_status_check;
UPDATE routers SET status = 'ACTIVE'  WHERE status = 'ONLINE';
UPDATE routers SET status = 'OFFLINE' WHERE status = 'DEGRADED';
ALTER TABLE routers ALTER COLUMN status SET DEFAULT 'PROVISIONING';
ALTER TABLE routers ADD CONSTRAINT routers_status_check
    CHECK (status IN ('PROVISIONING', 'ACTIVE', 'OFFLINE', 'REVOKED'));

-- Allocation semantics: a REVOKED router FREES its IP and port block for reuse.
-- Uniqueness must therefore only bind live (non-REVOKED) rows, otherwise a dead
-- REVOKED row would block reallocation of its slot to a brand-new router.
-- Replace the full UNIQUE on wg_allowed_ip (from V3) with a partial one.
ALTER TABLE routers DROP CONSTRAINT IF EXISTS routers_wg_allowed_ip_key;
CREATE UNIQUE INDEX uq_routers_wg_ip_live
    ON routers (wg_allowed_ip) WHERE status <> 'REVOKED';
CREATE UNIQUE INDEX uq_routers_dnat_port_base_live
    ON routers (dnat_port_base) WHERE status <> 'REVOKED';
