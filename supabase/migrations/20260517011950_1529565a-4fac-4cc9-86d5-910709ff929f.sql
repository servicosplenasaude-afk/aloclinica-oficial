
-- 1) Doctor profiles: oculta colunas sensíveis do papel anon
REVOKE SELECT (pix_key, kyc_face_match_score, kyc_status, kyc_verified_at,
               risk_score, auto_pause_reason, auto_paused_at, crm_verified_by)
ON public.doctor_profiles FROM anon;

-- 2) Coupons: exige autenticação para enxergar
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;
CREATE POLICY "Authenticated view active coupons"
  ON public.coupons FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 3) Exames: paciente vê os próprios
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='exames' AND column_name='paciente_id') THEN
    EXECUTE 'DROP POLICY IF EXISTS "paciente_ve_proprios_exames" ON public.exames';
    EXECUTE 'CREATE POLICY "paciente_ve_proprios_exames" ON public.exames
             FOR SELECT TO authenticated USING (auth.uid() = paciente_id)';
  END IF;
END $$;

-- 4) Recordings bucket: exige autenticação
DROP POLICY IF EXISTS "System upload recordings" ON storage.objects;
CREATE POLICY "Authenticated upload recordings"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'recordings');

-- 5) Prescription validations: esconde IP/UA do público
ALTER TABLE public.prescription_validations
  ADD COLUMN IF NOT EXISTS validator_ip INET,
  ADD COLUMN IF NOT EXISTS validator_user_agent TEXT;

REVOKE SELECT (validator_ip, validator_user_agent)
ON public.prescription_validations FROM anon;

-- 6) user_roles: explicit deny INSERT/UPDATE/DELETE para não-admins
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
