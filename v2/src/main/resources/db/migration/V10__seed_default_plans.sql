-- Default operator and plans for development/seed
-- In production, operators are created via the API

DO $$
DECLARE
    v_operator_id UUID;
BEGIN
    -- Only seed if no operators exist
    IF NOT EXISTS (SELECT 1 FROM operators LIMIT 1) THEN
        INSERT INTO operators (id, name, slug, tier)
        VALUES (gen_random_uuid(), 'Opérateur Démo', 'demo', 'PRO')
        RETURNING id INTO v_operator_id;

        INSERT INTO plans (operator_id, name, price_xof, duration_minutes, bandwidth_limit) VALUES
            (v_operator_id, '30 Minutes',  200,   30,  '2M/1M'),
            (v_operator_id, '1 Heure',     500,   60,  '3M/2M'),
            (v_operator_id, '3 Heures',   1000,  180,  '5M/3M'),
            (v_operator_id, '24 Heures',  2000, 1440,  '5M/3M'),
            (v_operator_id, 'Illimité 7j', 10000, 10080, '10M/5M');
    END IF;
END $$;
