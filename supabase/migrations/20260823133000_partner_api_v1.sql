-- Partner API v1: prevent self-escalation and provide atomic, idempotent booking.

DROP POLICY IF EXISTS "owner manages own keys" ON public.api_keys;
REVOKE INSERT, UPDATE, DELETE ON public.api_keys FROM authenticated;

CREATE OR REPLACE FUNCTION public.fn_verify_partner_api_key(p_prefix text, p_secret text)
RETURNS TABLE(id uuid, owner_user_id uuid, scopes text[], rate_limit_per_min integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT k.id, k.owner_user_id, k.scopes, k.rate_limit_per_min
  FROM public.api_keys k
  WHERE k.prefix = p_prefix
    AND k.is_active = true
    AND k.revoked_at IS NULL
    AND k.secret_hash = crypt(p_secret, k.secret_hash)
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.fn_verify_partner_api_key(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_verify_partner_api_key(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_admin_create_partner_api_key(
  p_actor_id uuid, p_owner_user_id uuid, p_label text, p_prefix text,
  p_secret text, p_scopes text[], p_rate_limit integer
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(p_actor_id, 'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_owner_user_id IS NULL OR length(trim(p_label)) NOT BETWEEN 3 AND 100 OR p_rate_limit NOT BETWEEN 1 AND 600 THEN RAISE EXCEPTION 'invalid_request'; END IF;
  INSERT INTO public.api_keys(owner_user_id,label,prefix,secret_hash,scopes,rate_limit_per_min)
  VALUES (p_owner_user_id, trim(p_label), p_prefix, crypt(p_secret, gen_salt('bf')), p_scopes, p_rate_limit)
  RETURNING id INTO v_id;
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,metadata)
  VALUES (p_actor_id,'partner_api_key.created','api_key',v_id,jsonb_build_object('owner_user_id',p_owner_user_id,'prefix',p_prefix,'scopes',p_scopes,'rate_limit',p_rate_limit));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_admin_create_partner_api_key(uuid,uuid,text,text,text,text[],integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_create_partner_api_key(uuid,uuid,text,text,text,text[],integer) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_admin_revoke_partner_api_key(p_actor_id uuid, p_api_key_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role(p_actor_id, 'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.api_keys SET is_active=false, revoked_at=now()
   WHERE id=p_api_key_id AND revoked_at IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,metadata)
  VALUES (p_actor_id,'partner_api_key.revoked','api_key',p_api_key_id,'{}'::jsonb);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_admin_revoke_partner_api_key(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_revoke_partner_api_key(uuid,uuid) TO service_role;

CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash text NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (api_key_id, idempotency_key)
);
ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_idempotency_keys FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_partner_create_appointment(
  p_api_key_id uuid,
  p_patient_id uuid,
  p_doctor_id uuid,
  p_scheduled_at timestamptz,
  p_idempotency_key text,
  p_request_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_previous public.api_idempotency_keys%ROWTYPE;
  v_doctor public.doctor_profiles%ROWTYPE;
  v_appointment public.appointments%ROWTYPE;
  v_local timestamp;
  v_duration integer;
  v_result jsonb;
BEGIN
  IF p_scheduled_at < now() + interval '15 minutes' OR p_scheduled_at > now() + interval '180 days' THEN
    RAISE EXCEPTION 'invalid_schedule';
  END IF;
  IF length(p_idempotency_key) NOT BETWEEN 8 AND 128 THEN RAISE EXCEPTION 'invalid_idempotency_key'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_api_key_id::text || ':' || p_idempotency_key, 0));
  SELECT * INTO v_previous FROM public.api_idempotency_keys
   WHERE api_key_id = p_api_key_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_previous.request_hash <> p_request_hash THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN v_previous.response_body || jsonb_build_object('idempotent_replay', true);
  END IF;

  SELECT * INTO v_doctor FROM public.doctor_profiles
   WHERE id = p_doctor_id AND COALESCE(is_active, false) AND COALESCE(is_approved, false)
   FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'doctor_unavailable'; END IF;
  v_duration := GREATEST(15, LEAST(COALESCE(v_doctor.consultation_duration_min, 30), 120));
  v_local := p_scheduled_at AT TIME ZONE 'America/Sao_Paulo';

  IF NOT EXISTS (
    SELECT 1 FROM public.availability_slots s
    WHERE s.doctor_id = p_doctor_id AND COALESCE(s.is_active, true)
      AND s.day_of_week = EXTRACT(DOW FROM v_local)::integer
      AND v_local::time >= s.start_time
      AND (v_local + make_interval(mins => v_duration))::time <= s.end_time
  ) THEN RAISE EXCEPTION 'outside_availability'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.doctor_absences a
    WHERE a.doctor_id = p_doctor_id AND v_local::date BETWEEN a.start_date AND a.end_date
  ) THEN RAISE EXCEPTION 'doctor_unavailable'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_doctor_id::text || ':' || p_scheduled_at::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.doctor_id = p_doctor_id AND a.status::text NOT IN ('cancelled', 'no_show')
      AND tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => COALESCE(a.duration_minutes, 30)), '[)')
          && tstzrange(p_scheduled_at, p_scheduled_at + make_interval(mins => v_duration), '[)')
  ) THEN RAISE EXCEPTION 'slot_unavailable'; END IF;

  INSERT INTO public.appointments
    (patient_id, doctor_id, scheduled_at, duration_minutes, status, payment_status, price_at_booking)
  VALUES
    (p_patient_id, p_doctor_id, p_scheduled_at, v_duration, 'scheduled', 'pending', v_doctor.consultation_price)
  RETURNING * INTO v_appointment;

  v_result := jsonb_build_object(
    'appointment', jsonb_build_object(
      'id', v_appointment.id, 'doctor_id', v_appointment.doctor_id,
      'scheduled_at', v_appointment.scheduled_at, 'duration_minutes', v_appointment.duration_minutes,
      'status', v_appointment.status, 'payment_status', v_appointment.payment_status
    ),
    'idempotent_replay', false
  );
  INSERT INTO public.api_idempotency_keys(api_key_id, idempotency_key, request_hash, response_body)
  VALUES (p_api_key_id, p_idempotency_key, p_request_hash, v_result);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_partner_create_appointment(uuid,uuid,uuid,timestamptz,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_partner_create_appointment(uuid,uuid,uuid,timestamptz,text,text) TO service_role;

CREATE INDEX IF NOT EXISTS idx_api_idempotency_created_at ON public.api_idempotency_keys(created_at);
NOTIFY pgrst, 'reload schema';
