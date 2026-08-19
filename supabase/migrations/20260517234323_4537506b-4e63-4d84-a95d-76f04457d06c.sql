-- 1) doctor_profiles: remove permissive public SELECT policy
DROP POLICY IF EXISTS "Public view approved doctors" ON public.doctor_profiles;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='doctor_profiles'
      AND policyname='Doctor self or admin can view'
  ) THEN
    CREATE POLICY "Doctor self or admin can view"
      ON public.doctor_profiles
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id OR public.is_admin());
  END IF;
END$$;

REVOKE SELECT ON public.doctor_profiles FROM anon;

-- 2) prescription_validations: remove permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view validations" ON public.prescription_validations;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='prescription_validations'
      AND policyname='Admin can view validations'
  ) THEN
    CREATE POLICY "Admin can view validations"
      ON public.prescription_validations
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
  END IF;
END$$;

REVOKE SELECT ON public.prescription_validations FROM anon, authenticated;
GRANT SELECT ON public.prescription_validations TO authenticated;

ALTER TABLE public.prescription_validations
  ADD COLUMN IF NOT EXISTS verification_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_valid BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

-- Public verification helper: returns only safe fields by verification_code
CREATE OR REPLACE FUNCTION public.verify_prescription_code(p_code text)
RETURNS TABLE(verification_code text, is_valid boolean, validated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT verification_code, is_valid, validated_at
  FROM public.prescription_validations
  WHERE verification_code = p_code
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_prescription_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_prescription_code(text) TO anon, authenticated;
