-- 1. Doctor signup invites
CREATE TABLE IF NOT EXISTS public.doctor_signup_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  email text,
  notes text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamptz,
  used_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dsi_code ON public.doctor_signup_invites(code);
CREATE INDEX IF NOT EXISTS idx_dsi_email ON public.doctor_signup_invites(lower(email));

ALTER TABLE public.doctor_signup_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_signup_invites FORCE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage doctor signup invites"
  ON public.doctor_signup_invites FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 2. Documents column on doctor_profiles
ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS documents jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3. Storage bucket for doctor documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('doctor-documents', 'doctor-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: doctor manages their own folder, admin reads all
DROP POLICY IF EXISTS "Doctors upload own documents" ON storage.objects;
CREATE POLICY "Doctors upload own documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'doctor-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Doctors read own documents" ON storage.objects;
CREATE POLICY "Doctors read own documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'doctor-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "Doctors update own documents" ON storage.objects;
CREATE POLICY "Doctors update own documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'doctor-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Admins delete doctor documents" ON storage.objects;
CREATE POLICY "Admins delete doctor documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'doctor-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

-- 4. Validate (SECURITY DEFINER — callable without seeing the row)
CREATE OR REPLACE FUNCTION public.validate_doctor_signup_invite(p_code text, p_email text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv record;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_code');
  END IF;

  SELECT * INTO v_inv FROM public.doctor_signup_invites
   WHERE upper(code) = upper(trim(p_code)) LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  IF v_inv.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_used');
  END IF;
  IF v_inv.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF v_inv.email IS NOT NULL
     AND lower(trim(v_inv.email)) <> lower(trim(coalesce(p_email,''))) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_mismatch');
  END IF;

  RETURN jsonb_build_object('ok', true, 'invite_id', v_inv.id);
END;
$$;

REVOKE ALL ON FUNCTION public.validate_doctor_signup_invite(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_doctor_signup_invite(text, text) TO anon, authenticated;

-- 5. Consume — only the authenticated user can mark their own
CREATE OR REPLACE FUNCTION public.consume_doctor_signup_invite(p_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rows int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  UPDATE public.doctor_signup_invites
     SET used_at = now(), used_by = v_uid
   WHERE upper(code) = upper(trim(p_code))
     AND used_at IS NULL
     AND expires_at >= now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_consumed');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_doctor_signup_invite(text) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_doctor_signup_invite(text) TO authenticated;

-- 6. Admin helper to create invite codes
CREATE OR REPLACE FUNCTION public.admin_create_doctor_signup_invite(
  p_email text DEFAULT NULL,
  p_expires_days int DEFAULT 30,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code text;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_code := upper(encode(extensions.gen_random_bytes(6), 'hex'));

  INSERT INTO public.doctor_signup_invites (code, email, notes, expires_at, created_by)
  VALUES (v_code, NULLIF(trim(p_email),''), p_notes,
          now() + (p_expires_days || ' days')::interval, auth.uid())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'code', v_code);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_doctor_signup_invite(text, int, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_create_doctor_signup_invite(text, int, text) TO authenticated;
