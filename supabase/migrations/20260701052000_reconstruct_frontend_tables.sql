-- ============================================================================
-- SCHEMA RECOVERY #2 (2026-07-01) — tabelas usadas pelo FRONTEND que faltavam.
--
-- A vistoria mostrou que o frontend consulta ~14 tabelas + 1 view que não
-- existem neste projeto Supabase (drift: migrations nunca aplicadas / squash).
-- Recuperadas a partir do uso real no código (colunas confirmadas contra as
-- migrations originais quando existiam). Idempotente. Escritas via service_role
-- (bypassa RLS); leituras com RLS por dono. Tabelas com PHI têm RLS ENABLE e
-- NUNCA SELECT público. Colunas em maioria NULLABLE (o app grava parcial).
-- ============================================================================

-- ========================= CLÍNICAS (PHI) ===================================

-- 1. care_plans (dono: patient_id) --------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid,
  doctor_id       uuid,
  appointment_id  uuid,
  title           text,
  description     text,
  objectives      jsonb DEFAULT '[]'::jsonb,
  medications     jsonb DEFAULT '[]'::jsonb,
  lifestyle       jsonb DEFAULT '[]'::jsonb,
  follow_up_date  timestamptz,
  follow_up_notes text,
  status          text DEFAULT 'active',
  updated_at      timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_care_plans_patient ON public.care_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_doctor  ON public.care_plans(doctor_id);
ALTER TABLE public.care_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS care_plans_owner_sel ON public.care_plans;
CREATE POLICY care_plans_owner_sel ON public.care_plans FOR SELECT
  USING (patient_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS care_plans_doctor_sel ON public.care_plans;
CREATE POLICY care_plans_doctor_sel ON public.care_plans FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id = care_plans.doctor_id AND dp.user_id = auth.uid()));

-- 2. clinical_anamnesis (dono: patient_id; doctor_id) -------------------------
CREATE TABLE IF NOT EXISTS public.clinical_anamnesis (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id              uuid,
  doctor_id               uuid,
  appointment_id          uuid,
  social_name             text,
  gender                  text,
  chief_complaint         text,
  history_present_illness text,
  past_medical_history    text,
  family_history          text,
  lifestyle_habits        text,
  review_of_systems       text,
  blood_pressure_sys      integer,
  blood_pressure_dia      integer,
  heart_rate              integer,
  respiratory_rate        integer,
  spo2                    numeric,
  temperature             numeric,
  weight                  numeric,
  height                  numeric,
  physical_exam_notes     text,
  diagnostic_hypothesis   text,
  cid_codes               text[] DEFAULT '{}',
  treatment_plan          text,
  updated_at              timestamptz DEFAULT now(),
  created_at              timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clinical_anamnesis_patient     ON public.clinical_anamnesis(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_anamnesis_appointment ON public.clinical_anamnesis(appointment_id);
ALTER TABLE public.clinical_anamnesis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clinical_anamnesis_owner_sel ON public.clinical_anamnesis;
CREATE POLICY clinical_anamnesis_owner_sel ON public.clinical_anamnesis FOR SELECT
  USING (patient_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS clinical_anamnesis_doctor_sel ON public.clinical_anamnesis;
CREATE POLICY clinical_anamnesis_doctor_sel ON public.clinical_anamnesis FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id = clinical_anamnesis.doctor_id AND dp.user_id = auth.uid()));

-- 3. clinical_evolution_audit (dono via record_id -> anamnesis) ---------------
CREATE TABLE IF NOT EXISTS public.clinical_evolution_audit (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id    uuid,
  record_table text DEFAULT 'clinical_anamnesis',
  changed_by   uuid,
  field_name   text,
  old_value    text,
  new_value    text,
  ip_address   text,
  user_agent   text,
  changed_at   timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clinical_evolution_audit_record ON public.clinical_evolution_audit(record_id);
ALTER TABLE public.clinical_evolution_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clinical_evolution_audit_owner_sel ON public.clinical_evolution_audit;
CREATE POLICY clinical_evolution_audit_owner_sel ON public.clinical_evolution_audit FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.clinical_anamnesis ca
      WHERE ca.id = clinical_evolution_audit.record_id
        AND (ca.patient_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id = ca.doctor_id AND dp.user_id = auth.uid()))
    )
  );

-- 4. medical_record_access_logs (dono: patient_id) ---------------------------
CREATE TABLE IF NOT EXISTS public.medical_record_access_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  uuid,
  record_id   uuid,
  accessed_by uuid,
  access_type text DEFAULT 'view',
  ip_address  text,
  user_agent  text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mral_patient ON public.medical_record_access_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_mral_by      ON public.medical_record_access_logs(accessed_by);
ALTER TABLE public.medical_record_access_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mral_owner_sel ON public.medical_record_access_logs;
CREATE POLICY mral_owner_sel ON public.medical_record_access_logs FOR SELECT
  USING (patient_id = auth.uid() OR accessed_by = auth.uid() OR public.is_admin());

-- 5. vaccination_records (dono: patient_id) ----------------------------------
CREATE TABLE IF NOT EXISTS public.vaccination_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid,
  doctor_id      uuid,
  vaccine_name   text,
  dose           text,
  date_given     date,
  next_dose_date date,
  lot_number     text,
  location       text,
  document_url   text,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vaccination_records_patient ON public.vaccination_records(patient_id);
ALTER TABLE public.vaccination_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vaccination_records_owner_sel ON public.vaccination_records;
CREATE POLICY vaccination_records_owner_sel ON public.vaccination_records FOR SELECT
  USING (patient_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS vaccination_records_doctor_sel ON public.vaccination_records;
CREATE POLICY vaccination_records_doctor_sel ON public.vaccination_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id = vaccination_records.doctor_id AND dp.user_id = auth.uid()));

-- 6. visual_acuity_results (dono: patient_id) --------------------------------
CREATE TABLE IF NOT EXISTS public.visual_acuity_results (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id         uuid,
  doctor_id          uuid,
  appointment_id     uuid,
  right_eye_distance text,
  left_eye_distance  text,
  right_eye_near     text,
  left_eye_near      text,
  right_sphere       numeric,
  right_cylinder     numeric,
  right_axis         integer,
  left_sphere        numeric,
  left_cylinder      numeric,
  left_axis          integer,
  right_add          numeric,
  left_add           numeric,
  pd_binocular       numeric,
  pd_right           numeric,
  pd_left            numeric,
  color_blind_test   text,
  amsler_grid_result text,
  iop_right          numeric,
  iop_left           numeric,
  notes              text,
  tested_by_patient  boolean DEFAULT false,
  created_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visual_acuity_results_patient ON public.visual_acuity_results(patient_id);
ALTER TABLE public.visual_acuity_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS visual_acuity_results_owner_sel ON public.visual_acuity_results;
CREATE POLICY visual_acuity_results_owner_sel ON public.visual_acuity_results FOR SELECT
  USING (patient_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS visual_acuity_results_doctor_sel ON public.visual_acuity_results;
CREATE POLICY visual_acuity_results_doctor_sel ON public.visual_acuity_results FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id = visual_acuity_results.doctor_id AND dp.user_id = auth.uid()));

-- 7. appointment_notes (dono via appointment_id -> appointments) -------------
CREATE TABLE IF NOT EXISTS public.appointment_notes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid,
  type           text DEFAULT 'soap',
  content        jsonb,
  updated_at     timestamptz DEFAULT now(),
  created_at     timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointment_notes_appt_type ON public.appointment_notes(appointment_id, type);
ALTER TABLE public.appointment_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS appointment_notes_owner_sel ON public.appointment_notes;
CREATE POLICY appointment_notes_owner_sel ON public.appointment_notes FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_notes.appointment_id
        AND (a.patient_id = auth.uid()
             OR a.doctor_id IN (SELECT dp.id FROM public.doctor_profiles dp WHERE dp.user_id = auth.uid()))
    )
  );

-- ========================= PLATAFORMA / OUTRAS ==============================

-- 8. ai_conversations (dono: user_id) ----------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text,
  messages jsonb,
  role_context text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON public.ai_conversations(user_id);
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_conversations_sel ON public.ai_conversations;
CREATE POLICY ai_conversations_sel ON public.ai_conversations FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- 9. doctor_applications (dono: user_id nullable; leitura admin) --------------
CREATE TABLE IF NOT EXISTS public.doctor_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  full_name text,
  email text,
  phone text,
  crm text,
  crm_state text,
  specialty text,
  bio text,
  status text DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  invite_code_id uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.doctor_applications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_doctor_applications_user_id ON public.doctor_applications(user_id);
ALTER TABLE public.doctor_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS doctor_applications_sel ON public.doctor_applications;
CREATE POLICY doctor_applications_sel ON public.doctor_applications FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- 10. health_cards (dono: user_id) -------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  card_number text,
  blood_type text,
  allergies text[] DEFAULT '{}',
  chronic_conditions text[] DEFAULT '{}',
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  health_plan_name text,
  health_plan_number text,
  health_plan_valid_until date,
  sus_card_number text,
  organ_donor boolean DEFAULT false,
  notes text,
  qr_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_health_cards_user_id ON public.health_cards(user_id);
ALTER TABLE public.health_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS health_cards_sel ON public.health_cards;
CREATE POLICY health_cards_sel ON public.health_cards FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- 11. health_tips (conteúdo público) -----------------------------------------
CREATE TABLE IF NOT EXISTS public.health_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.health_tips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS health_tips_sel ON public.health_tips;
CREATE POLICY health_tips_sel ON public.health_tips FOR SELECT USING (true);

-- 12. lgpd_access_log (dono: data_owner_id) ----------------------------------
CREATE TABLE IF NOT EXISTS public.lgpd_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_owner_id uuid,
  accessor_id uuid,
  accessor_role text,
  action text,
  resource text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lgpd_access_log_owner ON public.lgpd_access_log(data_owner_id);
ALTER TABLE public.lgpd_access_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lgpd_access_log_sel ON public.lgpd_access_log;
CREATE POLICY lgpd_access_log_sel ON public.lgpd_access_log FOR SELECT
  USING (data_owner_id = auth.uid() OR public.is_admin());

-- 13. lgpd_deletion_requests (dono: user_id) ---------------------------------
CREATE TABLE IF NOT EXISTS public.lgpd_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  reason text,
  status text DEFAULT 'pending',
  requested_at timestamptz DEFAULT now(),
  scheduled_deletion_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lgpd_deletion_requests_user ON public.lgpd_deletion_requests(user_id);
ALTER TABLE public.lgpd_deletion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lgpd_deletion_requests_sel ON public.lgpd_deletion_requests;
CREATE POLICY lgpd_deletion_requests_sel ON public.lgpd_deletion_requests FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- 14. site_sections_history (admin) ------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_sections_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text,
  config jsonb,
  saved_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_site_sections_history_key ON public.site_sections_history(section_key);
ALTER TABLE public.site_sections_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_sections_history_sel ON public.site_sections_history;
CREATE POLICY site_sections_history_sel ON public.site_sections_history FOR SELECT
  USING (public.is_admin());

-- 15. VIEW doctors → listagem pública (médicos aprovados) sobre doctor_profiles
CREATE OR REPLACE VIEW public.doctors AS
  SELECT id, user_id, crm, crm_state FROM public.doctor_profiles WHERE is_approved = true;
ALTER VIEW public.doctors SET (security_invoker = on);
