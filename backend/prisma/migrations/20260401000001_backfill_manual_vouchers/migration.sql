-- Backfill: create a COMPLETED/MANUAL transaction for every existing MANUAL
-- voucher that has no linked transaction.
-- Runs in a SEPARATE migration so the 'MANUAL' enum value is already committed.
DO $$
DECLARE
  v RECORD;
  new_tx_id UUID;
  tx_ref     TEXT;
  idem_key   TEXT;
BEGIN
  FOR v IN
    SELECT
      vo.id          AS voucher_id,
      vo.plan_id,
      vo.created_at,
      pl.price_xof,
      pl.slug        AS plan_slug
    FROM  vouchers     vo
    JOIN  plans        pl ON pl.id = vo.plan_id
    WHERE vo.generation_type = 'MANUAL'
      AND vo.transaction_id  IS NULL
  LOOP
    new_tx_id := gen_random_uuid();
    tx_ref    := 'BACKFILL-' || upper(substring(v.plan_slug, 1, 8)) || '-' || upper(substring(v.voucher_id::text, 1, 8));
    idem_key  := 'backfill-manual-' || v.voucher_id::text;

    INSERT INTO transactions (
      id,
      reference,
      plan_id,
      customer_phone,
      amount_xof,
      status,
      provider,
      paid_at,
      expires_at,
      idempotency_key,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      new_tx_id,
      tx_ref,
      v.plan_id,
      NULL,
      v.price_xof,
      'COMPLETED',
      'MANUAL',
      v.created_at,
      v.created_at,
      idem_key,
      jsonb_build_object(
        'source',      'backfill_manual_voucher',
        'voucher_id',  v.voucher_id
      ),
      v.created_at,
      now()
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    UPDATE vouchers
    SET    transaction_id = new_tx_id,
           updated_at     = now()
    WHERE  id             = v.voucher_id
      AND  transaction_id IS NULL;

  END LOOP;
END;
$$;
