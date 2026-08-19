-- =============================================================
-- NEW FEATURES: Care Plans, Health Card, Second Opinion,
-- Visual Acuity, LGPD Center, Consultation Recording
-- =============================================================

-- ── 1. CARE PLANS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.care_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id       UUID NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  objectives      JSONB DEFAULT '[]'::jsonb,  -- [{title, completed, due_date}]
  medications     JSONB DEFAULT '[]'::jsonb,  -- [{name, dosage, frequency, duration}]
  lifestyle       JSONB DEFAULT '[]'::jsonb,  -- [{category, instruction}]
  follow_up_date  DATE,
  follow_up_notes TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','completed','cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_plans_patient ON public.care_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_doctor  ON public.care_plans(doctor_id);

ALTER TABLE public.care_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_read_own_care_plans"
  ON public.care_plans FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "doctors_manage_care_plans"
  ON public.care_plans FOR ALL
  USING (
    doctor_id IN (
      SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "admins_care_plans"
  ON public.care_plans FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ── 2. HEALTH CARD DATA ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.health_cards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  card_number       TEXT UNIQUE DEFAULT 'ALO-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)),
  blood_type        TEXT CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  allergies         TEXT[] DEFAULT '{}',
  chronic_conditions TEXT[] DEFAULT '{}',
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  health_plan_name  TEXT,
  health_plan_number TEXT,
  health_plan_valid_until DATE,
  sus_card_number   TEXT,
  organ_donor       BOOLEAN DEFAULT false,
  notes             TEXT,
  qr_token          TEXT UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_cards_user   ON public.health_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_health_cards_qr     ON public.health_cards(qr_token);

ALTER TABLE public.health_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_health_card"
  ON public.health_cards FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "doctors_read_patient_health_card"
  ON public.health_cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
       WHERE (a.doctor_id IN (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid()))
         AND a.patient_id = health_cards.user_id
         AND a.status IN ('scheduled','waiting','in_progress','completed')
    )
  );

CREATE POLICY "admins_health_cards"
  ON public.health_cards FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ── 3. SECOND OPINION REQUESTS (Teleradiology) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.second_opinion_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_request_id   UUID REFERENCES public.exam_requests(id) ON DELETE CASCADE,
  original_laudo_id UUID,
  requesting_user_id UUID NOT NULL REFERENCES auth.users(id),
  assigned_laudista_id UUID REFERENCES auth.users(id),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','completed','declined')),
  priority          TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('normal','urgent')),
  reason            TEXT,
  original_report   TEXT,
  second_report     TEXT,
  consensus_notes   TEXT,
  accepted_at       TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  deadline          TIMESTAMPTZ DEFAULT now() + INTERVAL '48 hours',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_second_opinion_exam    ON public.second_opinion_requests(exam_request_id);
CREATE INDEX IF NOT EXISTS idx_second_opinion_status  ON public.second_opinion_requests(status);
CREATE INDEX IF NOT EXISTS idx_second_opinion_laudista ON public.second_opinion_requests(assigned_laudista_id);

ALTER TABLE public.second_opinion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "laudistas_see_second_opinions"
  ON public.second_opinion_requests FOR SELECT
  USING (
    requesting_user_id = auth.uid()
    OR assigned_laudista_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin','laudista'))
  );

CREATE POLICY "laudistas_update_second_opinions"
  ON public.second_opinion_requests FOR UPDATE
  USING (assigned_laudista_id = auth.uid() OR requesting_user_id = auth.uid());

CREATE POLICY "users_create_second_opinion"
  ON public.second_opinion_requests FOR INSERT
  WITH CHECK (requesting_user_id = auth.uid());

-- ── 4. VISUAL ACUITY RESULTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visual_acuity_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id       UUID REFERENCES public.doctor_profiles(id),
  appointment_id  UUID REFERENCES public.appointments(id),
  -- Snellen results (e.g. "20/20", "20/40")
  right_eye_distance TEXT,
  left_eye_distance  TEXT,
  right_eye_near     TEXT,
  left_eye_near      TEXT,
  -- Refraction
  right_sphere    NUMERIC(5,2),  right_cylinder NUMERIC(5,2), right_axis INTEGER,
  left_sphere     NUMERIC(5,2),  left_cylinder  NUMERIC(5,2), left_axis  INTEGER,
  right_add       NUMERIC(5,2),  left_add       NUMERIC(5,2),
  -- Pupillary distance
  pd_binocular    NUMERIC(5,1),
  pd_right        NUMERIC(5,1),
  pd_left         NUMERIC(5,1),
  -- Additional tests
  color_blind_test    TEXT,  -- 'normal' | 'deuteranopia' | 'protanopia' | 'tritanopia'
  amsler_grid_result  TEXT,  -- 'normal' | 'distorted' | 'scotoma'
  iop_right       NUMERIC(5,1),   -- intraocular pressure mmHg
  iop_left        NUMERIC(5,1),
  notes           TEXT,
  tested_by_patient BOOLEAN DEFAULT false,  -- self-test vs doctor-administered
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visual_acuity_patient ON public.visual_acuity_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_visual_acuity_doctor  ON public.visual_acuity_results(doctor_id);

ALTER TABLE public.visual_acuity_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_read_own_va" ON public.visual_acuity_results FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "doctors_manage_va" ON public.visual_acuity_results FOR ALL
  USING (doctor_id IN (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid()));
CREATE POLICY "patients_insert_self_test" ON public.visual_acuity_results FOR INSERT
  WITH CHECK (patient_id = auth.uid() AND tested_by_patient = true);

-- ── 5. CONSULTATION RECORDINGS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consultation_recordings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES auth.users(id),
  doctor_id       UUID NOT NULL REFERENCES public.doctor_profiles(id),
  consent_given   BOOLEAN NOT NULL DEFAULT false,
  consent_at      TIMESTAMPTZ,
  storage_path    TEXT,         -- path in Supabase Storage
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','recording','processing','ready','failed','deleted')),
  expires_at      TIMESTAMPTZ DEFAULT now() + INTERVAL '90 days',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recordings_appointment ON public.consultation_recordings(appointment_id);
CREATE INDEX IF NOT EXISTS idx_recordings_patient     ON public.consultation_recordings(patient_id);

ALTER TABLE public.consultation_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants_access_recordings"
  ON public.consultation_recordings FOR ALL
  USING (
    patient_id = auth.uid()
    OR doctor_id IN (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid())
  );

-- ── 6. LGPD ACCESS LOG ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lgpd_access_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_owner_id UUID NOT NULL REFERENCES auth.users(id),  -- whose data
  accessor_id   UUID REFERENCES auth.users(id),           -- who accessed (null = system)
  accessor_role TEXT,
  action        TEXT NOT NULL,  -- 'read', 'write', 'export', 'delete'
  resource      TEXT NOT NULL,  -- 'medical_records', 'prescriptions', etc.
  resource_id   UUID,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lgpd_log_owner    ON public.lgpd_access_log(data_owner_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_log_created  ON public.lgpd_access_log(created_at DESC);

ALTER TABLE public.lgpd_access_log ENABLE ROW LEVEL SECURITY;

-- Patients can only see their own access log
CREATE POLICY "patients_read_own_lgpd_log"
  ON public.lgpd_access_log FOR SELECT
  USING (data_owner_id = auth.uid());

-- System inserts (service role) and admins
CREATE POLICY "admins_lgpd_log"
  ON public.lgpd_access_log FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ── 7. LGPD DELETION REQUESTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lgpd_deletion_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','processing','completed','denied')),
  admin_notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  scheduled_deletion_at TIMESTAMPTZ DEFAULT now() + INTERVAL '30 days'
);

ALTER TABLE public.lgpd_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_deletion_request"
  ON public.lgpd_deletion_requests FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "admins_deletion_requests"
  ON public.lgpd_deletion_requests FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ── 8. VACCINATION RECORDS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vaccination_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vaccine_name  TEXT NOT NULL,
  dose          TEXT,   -- '1st', '2nd', 'booster'
  date_given    DATE NOT NULL,
  next_dose_date DATE,
  lot_number    TEXT,
  location      TEXT,
  doctor_id     UUID REFERENCES public.doctor_profiles(id),
  document_url  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vaccinations_patient ON public.vaccination_records(patient_id);

ALTER TABLE public.vaccination_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_manage_vaccinations"
  ON public.vaccination_records FOR ALL
  USING (patient_id = auth.uid());

CREATE POLICY "doctors_read_vaccinations"
  ON public.vaccination_records FOR SELECT
  USING (doctor_id IN (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid()));

-- ── Storage bucket for recordings ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'consultation-recordings',
  'consultation-recordings',
  false,
  524288000,  -- 500MB
  ARRAY['video/webm', 'video/mp4', 'audio/webm', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- RLS for recordings storage
CREATE POLICY "participants_access_recording_storage"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'consultation-recordings'
    AND auth.role() = 'authenticated'
    AND (
      -- Path format: appointment_id/user_id/file
      SPLIT_PART(name, '/', 2) = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.consultation_recordings cr
         WHERE cr.storage_path LIKE '%' || SPLIT_PART(name, '/', 1) || '%'
           AND (
             cr.patient_id = auth.uid()
             OR cr.doctor_id IN (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid())
           )
      )
    )
  );
