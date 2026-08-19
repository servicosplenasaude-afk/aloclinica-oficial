
-- 1) Drop overly broad public SELECT policies that exposed all columns
DROP POLICY IF EXISTS "Public can view approved active doctors" ON public.doctor_profiles;
DROP POLICY IF EXISTS "Public can view doctor profiles" ON public.profiles;

-- 2) doctor_profiles: restrict anon to safe columns only
REVOKE SELECT ON public.doctor_profiles FROM anon;
GRANT SELECT (
  id, user_id, crm, crm_state, crm_verified, bio, consultation_price,
  consultation_duration_min, is_approved, is_active, available_now,
  full_name, avatar_url, sub_specialties, education, rating, total_reviews,
  available_for_telemedicine, doctor_type, council_type, council_number, council_state
) ON public.doctor_profiles TO anon;

CREATE POLICY "Anon can list approved active doctors (safe cols)"
  ON public.doctor_profiles
  FOR SELECT
  TO anon
  USING (COALESCE(is_approved,false) = true AND COALESCE(is_active,false) = true);

-- 3) profiles: restrict anon to safe public columns and re-create a narrower public listing policy
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, user_id, first_name, last_name, avatar_url)
  ON public.profiles TO anon;

CREATE POLICY "Anon can view doctor public profile names"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM public.doctor_profiles dp
    WHERE dp.user_id = profiles.user_id
      AND COALESCE(dp.is_approved,false) = true
      AND COALESCE(dp.is_active,false) = true
  ));

-- 4) medical_certificates: remove duplicate policy with broken auth.uid() = doctor_id clause
DROP POLICY IF EXISTS "patient sees own certificates" ON public.medical_certificates;

-- 5) recordings storage bucket: only doctors may upload
DROP POLICY IF EXISTS "Authenticated upload recordings" ON storage.objects;
CREATE POLICY "Doctors upload recordings"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'recordings'
    AND public.has_role(auth.uid(), 'doctor'::public.app_role)
  );
