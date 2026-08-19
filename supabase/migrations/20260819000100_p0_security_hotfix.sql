-- P0 security hotfix: profiles PII isolation and public document minimization.

-- Remove every historical authenticated-wide profile policy. The anon-only
-- doctor-name policy remains safe because anon has a column-level allowlist.
DROP POLICY IF EXISTS "Users can view all basic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view doctor profiles" ON public.profiles;

-- Preserve the legitimate clinical workflow: a doctor may read the profile of
-- a patient only while a consultation is active. Owner/admin policies already
-- exist and remain unchanged.
DROP POLICY IF EXISTS "Doctors can view profiles for active consultations" ON public.profiles;
CREATE POLICY "Doctors can view profiles for active consultations"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.appointments a
      JOIN public.doctor_profiles dp ON dp.id = a.doctor_id
      WHERE a.patient_id = profiles.user_id
        AND dp.user_id = auth.uid()
        AND a.status IN ('scheduled', 'waiting', 'confirmed', 'in_progress')
    )
  );

-- Public verification exposes authenticity metadata, never clinical content.
-- Build details from an allowlist so future columns/JSON keys cannot leak.
CREATE OR REPLACE FUNCTION public.verify_document_public(p_code text)
RETURNS TABLE(
  verification_code text,
  document_type text,
  patient_name text,
  doctor_name text,
  doctor_crm text,
  issued_at timestamptz,
  details jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    dv.verification_code,
    dv.document_type,
    dv.patient_name,
    dv.doctor_name,
    dv.doctor_crm,
    dv.created_at AS issued_at,
    CASE
      WHEN jsonb_typeof(COALESCE(dv.details, '{}'::jsonb)->'medications') = 'array'
        THEN jsonb_build_object(
          'medication_count',
          jsonb_array_length(COALESCE(dv.details, '{}'::jsonb)->'medications')
        )
      ELSE '{}'::jsonb
    END AS details
  FROM public.document_verifications dv
  WHERE dv.verification_code = p_code
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.verify_document_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_document_public(text) TO anon, authenticated;

-- Serialize each user/endpoint bucket so concurrent requests cannot race past
-- the limit. Only Edge Functions holding service_role may call this RPC.
CREATE OR REPLACE FUNCTION public.check_ai_assistant_rate_limit(
  p_identifier text,
  p_endpoint text,
  p_max_requests integer,
  p_window_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count bigint;
BEGIN
  IF p_identifier IS NULL OR p_identifier = ''
     OR p_endpoint IS NULL OR p_endpoint = ''
     OR p_max_requests <= 0
     OR p_window_minutes <= 0 THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_identifier || ':' || p_endpoint, 0));

  SELECT count(*) INTO v_count
  FROM public.rate_limits
  WHERE identifier = p_identifier
    AND endpoint = p_endpoint
    AND window_start >= now() - make_interval(mins => p_window_minutes);

  IF v_count >= p_max_requests THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limits (identifier, endpoint, window_start)
  VALUES (p_identifier, p_endpoint, now());
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.check_ai_assistant_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_assistant_rate_limit(text, text, integer, integer) TO service_role;
