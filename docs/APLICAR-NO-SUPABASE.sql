-- =============================================================================
-- AloClínica — MIGRATIONS PENDENTES (aplicar no Supabase)
-- =============================================================================
-- Contexto: o Lovable NÃO está aplicando as migrations no banco. As correções
-- de código já estão no ar (Cloudflare), mas estas mudanças de BANCO precisam
-- ser rodadas manualmente.
--
-- COMO APLICAR (1x): Supabase Dashboard → SQL Editor → New query →
--   cole TODO este arquivo → Run.
--
-- É SEGURO: tudo é idempotente (IF NOT EXISTS / CREATE OR REPLACE /
-- DROP ... IF EXISTS). Pode rodar de novo sem quebrar nada.
-- =============================================================================

-- 1) Idempotência da confirmação de consulta (evita e-mail/WhatsApp duplicado)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;

-- 2) SEGURANÇA: impede médico de se autoaprovar (trava colunas de verificação
--    para usuário comum; admin e servidor continuam podendo alterar)
CREATE OR REPLACE FUNCTION public.protect_doctor_verification_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  NEW.crm_verified         := OLD.crm_verified;
  NEW.crm_verified_at      := OLD.crm_verified_at;
  NEW.kyc_status           := OLD.kyc_status;
  NEW.kyc_verified_at      := OLD.kyc_verified_at;
  NEW.kyc_face_match_score := OLD.kyc_face_match_score;
  NEW.is_approved          := OLD.is_approved;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS zzz_protect_doctor_verification ON public.doctor_profiles;
CREATE TRIGGER zzz_protect_doctor_verification
  BEFORE UPDATE ON public.doctor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_doctor_verification_fields();

-- 3) PagBank: coluna do Account ID do médico (para split; PagBank fica p/ depois)
ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS pagbank_account_id text;

-- 4) Convite de médico: doctor_id pode ser nulo (o código nasce ANTES do médico
--    existir). SEM isto, gerar código de convite falha (NOT NULL) e nenhum
--    médico novo consegue se cadastrar.
ALTER TABLE public.doctor_invite_codes ALTER COLUMN doctor_id DROP NOT NULL;

-- 5) Campos do perfil do médico que faltavam na base (education/experiência/
--    chamada curta/aparecer no diretório/auto-confirmar). Sem elas, o perfil
--    não salvava esses campos.
ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS education text,
  ADD COLUMN IF NOT EXISTS experience_years integer,
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS show_in_directory boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_confirm_bookings boolean NOT NULL DEFAULT true;

-- 6) Perfil público passa a EXIBIR education/experiência/chamada curta
--    (antes eram NULL fixos no view). Roda DEPOIS do passo 5.
CREATE OR REPLACE VIEW public.doctor_profiles_public AS
SELECT dp.id,
    COALESCE(NULLIF(TRIM(BOTH FROM (COALESCE(p.first_name, ''::text) || ' '::text) || COALESCE(p.last_name, ''::text)), ''::text), dp.display_name) AS full_name,
    dp.display_name,
    COALESCE(dp.professional_photo_url, p.avatar_url) AS avatar_url,
    dp.crm,
    dp.crm_state,
    COALESCE(dp.crm_verified, false) AS crm_verified,
    dp.bio,
    dp.short_description,
    dp.price AS consultation_price,
    dp.consultation_duration AS consultation_duration_min,
    COALESCE(dp.rating_avg, 0::numeric) AS rating,
    COALESCE(dp.rating_count, 0) AS total_reviews,
    dp.experience_years,
    COALESCE(dp.is_on_duty, false) AS available_now,
    dp.doctor_type = 'telemedicina'::text AS available_for_telemedicine,
    dp.areas_of_expertise AS sub_specialties,
    dp.education,
    dp.doctor_type,
    COALESCE(dp.council_type::text, 'CRM'::text) AS council_type,
    COALESCE(ARRAY(
      SELECT s.name FROM doctor_specialties ds
      JOIN specialties s ON s.id = ds.specialty_id
      WHERE ds.doctor_id = dp.id ORDER BY s.name
    ), ARRAY[]::text[]) AS specialty_names,
    (EXISTS (SELECT 1 FROM availability_slots a
             WHERE a.doctor_id = dp.id AND COALESCE(a.is_active, true) = true)) AS has_availability
FROM doctor_profiles dp
LEFT JOIN profiles p ON p.user_id = dp.user_id
WHERE COALESCE(dp.is_approved, false) = true AND COALESCE(dp.is_active, false) = true;

-- 7) SEGURANÇA: isolamento de protocolos clínicos por médico (antes qualquer
--    médico via/editava os de todos).
DROP POLICY IF EXISTS "anyone authenticated reads active protocols" ON public.clinical_protocols;
DROP POLICY IF EXISTS "doctor or admin manages own protocols" ON public.clinical_protocols;
DROP POLICY IF EXISTS "read own or global protocols" ON public.clinical_protocols;
DROP POLICY IF EXISTS "manage own protocols" ON public.clinical_protocols;

CREATE POLICY "read own or global protocols" ON public.clinical_protocols
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR created_by = auth.uid()
    OR created_by IS NULL
  );
CREATE POLICY "manage own protocols" ON public.clinical_protocols
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR auth.uid() = created_by
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR auth.uid() = created_by
  );

-- =============================================================================
-- FIM. Depois de rodar, o app reflete: gerar convite de médico, campos extras
-- do perfil, perfil público com formação/experiência, e protocolos isolados.
-- =============================================================================
