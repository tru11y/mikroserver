CREATE TABLE sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    router_id     UUID NOT NULL REFERENCES routers(id),
    voucher_id    UUID REFERENCES vouchers(id),
    mac_address   TEXT NOT NULL,
    ip_address    INET,
    bytes_in      BIGINT NOT NULL DEFAULT 0,
    bytes_out     BIGINT NOT NULL DEFAULT 0,
    uptime_secs   INT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at      TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_router ON sessions (router_id) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_voucher ON sessions (voucher_id);
CREATE INDEX idx_sessions_mac ON sessions (mac_address, router_id);
