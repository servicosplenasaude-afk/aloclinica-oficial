-- Server-side, atomic confirmation for payouts paid outside an integrated gateway.
CREATE OR REPLACE FUNCTION public.fn_admin_confirm_manual_payout(
  p_payout_id uuid,
  p_transaction_id text,
  p_admin_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout public.doctor_payouts%ROWTYPE;
BEGIN
  IF p_transaction_id IS NULL OR length(btrim(p_transaction_id)) < 6 OR length(p_transaction_id) > 160 THEN
    RAISE EXCEPTION 'invalid transaction id';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_payout FROM public.doctor_payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND OR v_payout.status <> 'ready' THEN
    RAISE EXCEPTION 'payout not ready';
  END IF;
  UPDATE public.doctor_payouts
     SET status = 'paid', paid_at = now(), pix_tx_id = btrim(p_transaction_id), updated_at = now()
   WHERE id = p_payout_id AND status = 'ready';

  INSERT INTO public.activity_logs(user_id, performed_by, action, entity_type, entity_id, details)
  VALUES (NULL, p_admin_id, 'manual_payout_confirmed', 'doctor_payout', p_payout_id,
    jsonb_build_object('transaction_id', btrim(p_transaction_id), 'confirmation_source', 'external_statement_verified',
      'previous_status', v_payout.status, 'doctor_id', v_payout.doctor_id, 'net_amount', v_payout.net_amount));

  RETURN jsonb_build_object('id', p_payout_id, 'status', 'paid');
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_confirm_manual_payout(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_confirm_manual_payout(uuid,text,uuid) TO service_role;
