
ALTER VIEW public.doctor_profiles_public SET (security_invoker = true);

ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Public read of approved+active doctor rows (only non-sensitive columns are exposed via the view)
DROP POLICY IF EXISTS "Public can view approved active doctors" ON public.doctor_profiles;
CREATE POLICY "Public can view approved active doctors"
ON public.doctor_profiles
FOR SELECT
TO anon, authenticated
USING (COALESCE(is_approved, false) = true AND COALESCE(is_active, false) = true);

-- Public read of profile rows that belong to approved+active doctors (for name/avatar)
DROP POLICY IF EXISTS "Public can view doctor profiles" ON public.profiles;
CREATE POLICY "Public can view doctor profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.doctor_profiles dp
    WHERE dp.user_id = profiles.user_id
      AND COALESCE(dp.is_approved, false) = true
      AND COALESCE(dp.is_active, false) = true
  )
);
