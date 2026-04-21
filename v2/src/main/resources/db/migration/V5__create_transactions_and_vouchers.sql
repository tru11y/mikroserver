CREATE TABLE transactions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id          UUID NOT NULL REFERENCES operators(id),
    wave_transaction_id  TEXT NOT NULL UNIQUE,
    amount_xof           INT NOT NULL CHECK (amount_xof > 0),
    status               TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    phone_number         TEXT NOT NULL,
    plan_id              UUID REFERENCES plans(id),
    router_id            UUID REFERENCES routers(id),
    idempotency_key      TEXT NOT NULL UNIQUE,
    raw_webhook_payload  JSONB,
    webhook_received_at  TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_wave_id ON transactions (wave_transaction_id);
CREATE INDEX idx_transactions_operator ON transactions (operator_id);
CREATE INDEX idx_transactions_status ON transactions (status);

CREATE TABLE vouchers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id       UUID NOT NULL REFERENCES operators(id),
    transaction_id    UUID REFERENCES transactions(id),
    plan_id           UUID NOT NULL REFERENCES plans(id),
    router_id         UUID NOT NULL REFERENCES routers(id),
    code              TEXT NOT NULL UNIQUE,
    hotspot_username  TEXT NOT NULL,
    hotspot_password  TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'CONSUMED', 'EXPIRED')),
    activated_at      TIMESTAMPTZ,
    expires_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vouchers_operator ON vouchers (operator_id);
CREATE INDEX idx_vouchers_router ON vouchers (router_id);
CREATE INDEX idx_vouchers_code ON vouchers (code);
CREATE INDEX idx_vouchers_status ON vouchers (status);
