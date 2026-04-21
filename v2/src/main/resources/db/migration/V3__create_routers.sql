CREATE TABLE routers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id       UUID NOT NULL REFERENCES operators(id),
    name              TEXT NOT NULL,
    mac_address       TEXT,
    wg_public_key     TEXT NOT NULL,
    wg_private_key_enc TEXT, -- encrypted, only stored transiently for provisioning
    wg_allowed_ip     INET NOT NULL UNIQUE,
    wg_endpoint       TEXT,
    api_port          INT NOT NULL DEFAULT 8728,
    api_username      TEXT NOT NULL DEFAULT 'admin',
    api_password_enc  TEXT,
    status            TEXT NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('OFFLINE', 'ONLINE', 'DEGRADED')),
    last_handshake_at TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_routers_operator ON routers (operator_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_routers_status ON routers (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_routers_wg_ip ON routers (wg_allowed_ip) WHERE deleted_at IS NULL;
