
-- =========================================================
-- 1. document_verifications: lock down + safe verification RPC
-- =========================================================
DROP POLICY IF EXISTS "Anyone can verify" ON public.document_verifications;
DROP POLICY IF EXISTS "Anyone can verify documents by code" ON public.document_verifications;
DROP POLICY IF EXISTS "Anyone can view verification by code" ON public.document_verifications;

ALTER TABLE public.document_verifications
  ADD COLUMN IF NOT EXISTS signer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_valid BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE POLICY "Signer or admin can read verifications"
ON public.document_verifications
FOR SELECT
TO authenticated
USING (signer_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.verify_document_by_code(_code text)
RETURNS TABLE (
  is_valid boolean,
  document_type text,
  verified_at timestamptz,
  patient_name_masked text,
  doctor_name text,
  doctor_crm text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dv.is_valid,
    dv.document_type,
    dv.verified_at,
    CASE
      WHEN dv.patient_name IS NULL THEN NULL
      WHEN length(dv.patient_name) <= 2 THEN dv.patient_name
      ELSE left(dv.patient_name, 1) || '***' || right(dv.patient_name, 1)
    END,
    dv.doctor_name,
    dv.doctor_crm
  FROM public.document_verifications dv
  WHERE dv.verification_code = _code
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_document_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_document_by_code(text) TO anon, authenticated;

-- =========================================================
-- 2. guest_patients: require auth + creator
-- =========================================================
DROP POLICY IF EXISTS "Guest patients can be created" ON public.guest_patients;

ALTER TABLE public.guest_patients
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE POLICY "Authenticated users create their own guest patients"
ON public.guest_patients
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- =========================================================
-- 3. health_metrics: doctor must have an appointment
-- =========================================================
DROP POLICY IF EXISTS "Doctors view patient metrics" ON public.health_metrics;

CREATE POLICY "Doctors view metrics of their patients"
ON public.health_metrics
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'doctor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.doctor_id = auth.uid()
      AND a.patient_id = health_metrics.patient_id
  )
);

-- =========================================================
-- 4. user_presence: own row + admins
-- =========================================================
DROP POLICY IF EXISTS "Anyone can view presence" ON public.user_presence;

CREATE POLICY "Users view own presence or admins view all"
ON public.user_presence
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- 5. employee_invites_token_accept: scoped USING
-- =========================================================
DROP POLICY IF EXISTS "employee_invites_token_accept" ON public.employee_invites;

CREATE POLICY "employee_invites_token_accept"
ON public.employee_invites
FOR UPDATE
TO authenticated
USING (
  status = 'pending'
  AND (expires_at IS NULL OR expires_at > now())
  AND (user_id IS NULL OR user_id = auth.uid())
)
WITH CHECK (
  status = 'accepted'
  AND user_id = auth.uid()
);

-- =========================================================
-- 6. sweepstake_winners: lock down read
-- =========================================================
DROP POLICY IF EXISTS "sweepstake_winners_public_read" ON public.sweepstake_winners;

CREATE POLICY "sweepstake_winners_owner_or_admin_read"
ON public.sweepstake_winners
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_admin());

-- =========================================================
-- 7. storage: dicom-bucket -> role-scoped only
-- =========================================================
DROP POLICY IF EXISTS "Auth users can read dicom files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update dicom files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload dicom files" ON storage.objects;

CREATE POLICY "Privileged roles read dicom files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'dicom-bucket'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'doctor'::app_role)
    OR has_role(auth.uid(), 'laudista'::app_role)
    OR has_role(auth.uid(), 'clinic'::app_role)
  )
);

CREATE POLICY "Privileged roles upload dicom files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dicom-bucket'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'doctor'::app_role)
    OR has_role(auth.uid(), 'laudista'::app_role)
    OR has_role(auth.uid(), 'clinic'::app_role)
  )
);

CREATE POLICY "Privileged roles update dicom files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dicom-bucket'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'doctor'::app_role)
    OR has_role(auth.uid(), 'laudista'::app_role)
    OR has_role(auth.uid(), 'clinic'::app_role)
  )
);

-- =========================================================
-- 8. storage: exames bucket -> path ownership OR privileged role
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can view exams" ON storage.objects;

CREATE POLICY "Owner or privileged role views exams"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'exames'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'doctor'::app_role)
    OR has_role(auth.uid(), 'laudista'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'clinic'::app_role)
  )
);

-- =========================================================
-- 9. storage: receitas-assinadas -> remove public read, scoped insert
-- =========================================================
DROP POLICY IF EXISTS "Anyone can view signed prescriptions" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload signed prescriptions" ON storage.objects;

CREATE POLICY "Authorized read signed prescriptions"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receitas-assinadas'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'doctor'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Doctors upload signed prescriptions"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receitas-assinadas'
  AND (
    has_role(auth.uid(), 'doctor'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- =========================================================
-- 10. storage: laudos-assinados -> drop public read
-- (Authorized view laudos already exists with role-scoped access)
-- =========================================================
DROP POLICY IF EXISTS "Anyone can view signed laudos" ON storage.objects;

-- =========================================================
-- 11. function search_path hardening
-- =========================================================
ALTER FUNCTION public.on_appointment_status_change() SET search_path = public;
ALTER FUNCTION public.touch_app_settings() SET search_path = public;
ALTER FUNCTION public.touch_notification_templates() SET search_path = public;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
