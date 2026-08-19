-- PagBank + withdrawals: durable idempotency and server-authoritative money movement.
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS pagbank_order_id text,
  ADD COLUMN IF NOT EXISTS pagbank_reference_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_transactions_pagbank_order
  ON public.payment_transactions (pagbank_order_id) WHERE pagbank_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_transactions_pagbank_reference
  ON public.payment_transactions (pagbank_reference_id) WHERE pagbank_reference_id IS NOT NULL;

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS request_source text NOT NULL DEFAULT 'manual';

-- Existing duplicate pending rows cannot both represent the same ledger balance.
-- Keep the oldest request and make later, never-processed duplicates auditable.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) AS rn
  FROM public.withdrawal_requests WHERE status = 'pending'
)
UPDATE public.withdrawal_requests w SET status = 'rejected',
  notes = concat_ws(E'\n', w.notes, 'Duplicata pendente encerrada pela migration de hardening.'),
  updated_at = now()
FROM ranked r WHERE w.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_withdrawal_one_active_per_user
  ON public.withdrawal_requests (user_id)
  WHERE status IN ('pending', 'approved', 'processing', 'pending_manual');

-- The amount is deliberately not an argument: the ledger is the authority.
CREATE OR REPLACE FUNCTION public.fn_create_withdrawal_request(
  p_pix_key text,
  p_source text DEFAULT 'manual',
  p_user_id uuid DEFAULT NULL
) RETURNS public.withdrawal_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
  v_user_id uuid;
  v_doctor_id uuid;
  v_amount numeric;
  v_result public.withdrawal_requests;
BEGIN
  IF v_role = 'service_role' THEN
    v_user_id := p_user_id;
  ELSE
    v_user_id := auth.uid();
    IF p_user_id IS NOT NULL AND p_user_id <> v_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF p_source <> 'manual' THEN RAISE EXCEPTION 'forbidden source'; END IF;
  END IF;
  IF v_user_id IS NULL OR NULLIF(btrim(p_pix_key), '') IS NULL THEN RAISE EXCEPTION 'user and pix key required'; END IF;

  -- Serializes manual and cron creation for this doctor.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  SELECT id INTO v_doctor_id FROM public.doctor_profiles WHERE user_id = v_user_id AND is_active = true;
  IF v_doctor_id IS NULL THEN RAISE EXCEPTION 'active doctor not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.withdrawal_requests WHERE user_id = v_user_id
             AND status IN ('pending','approved','processing','pending_manual')) THEN
    RAISE EXCEPTION 'active withdrawal already exists' USING ERRCODE = 'unique_violation';
  END IF;
  SELECT COALESCE(SUM(net_amount), 0) INTO v_amount
    FROM public.doctor_payouts WHERE doctor_id = v_doctor_id AND status = 'ready';
  IF v_amount < 50 THEN RAISE EXCEPTION 'minimum withdrawal is 50'; END IF;

  INSERT INTO public.withdrawal_requests(user_id, amount, status, pix_key, request_source)
  VALUES (v_user_id, v_amount, 'pending', btrim(p_pix_key), p_source)
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_create_withdrawal_request(text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_withdrawal_request(text,text,uuid) TO authenticated, service_role;
REVOKE INSERT ON TABLE public.withdrawal_requests FROM anon, authenticated;

-- Claim exactly the amount recorded by the authoritative creation RPC.
CREATE OR REPLACE FUNCTION public.fn_claim_ready_payouts(p_doctor_id uuid, p_withdrawal_id uuid DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_total numeric; v_expected numeric; v_owner uuid;
BEGIN
  IF p_withdrawal_id IS NULL THEN RAISE EXCEPTION 'withdrawal id required'; END IF;
  SELECT amount, user_id INTO v_expected, v_owner FROM public.withdrawal_requests
    WHERE id = p_withdrawal_id AND status = 'processing' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal not claimable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.doctor_profiles WHERE id=p_doctor_id AND user_id=v_owner) THEN
    RAISE EXCEPTION 'withdrawal owner mismatch';
  END IF;
  UPDATE public.doctor_payouts SET status='paid', withdrawal_id=p_withdrawal_id,
    paid_at=now(), updated_at=now() WHERE doctor_id=p_doctor_id AND status='ready';
  SELECT COALESCE(SUM(net_amount),0) INTO v_total FROM public.doctor_payouts
    WHERE doctor_id=p_doctor_id AND status='paid' AND withdrawal_id=p_withdrawal_id;
  IF v_total <> v_expected THEN RAISE EXCEPTION 'claimed amount mismatch: expected %, got %', v_expected, v_total; END IF;
  RETURN v_total;
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_claim_ready_payouts(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_ready_payouts(uuid,uuid) TO service_role;
