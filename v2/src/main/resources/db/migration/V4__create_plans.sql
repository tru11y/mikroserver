CREATE TABLE plans (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id       UUID NOT NULL REFERENCES operators(id),
    name              TEXT NOT NULL,
    price_xof         INT NOT NULL CHECK (price_xof > 0),
    duration_minutes  INT NOT NULL CHECK (duration_minutes > 0),
    bandwidth_limit   TEXT, -- e.g. "2M/1M" (MikroTik rate-limit format)
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_plans_operator ON plans (operator_id) WHERE deleted_at IS NULL;
