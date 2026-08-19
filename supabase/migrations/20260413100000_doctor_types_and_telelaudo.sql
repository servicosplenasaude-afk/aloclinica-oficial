-- =====================================================================
-- FASE 1 — Doctor types: laudista, ophthalmologist + doctor_type field
-- =====================================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'laudista';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ophthalmologist';

DO $$ BEGIN
  CREATE TYPE public.doctor_type AS ENUM ('telemedicina', 'laudista', 'oftalmologia');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS doctor_type public.doctor_type NOT NULL DEFAULT 'telemedicina';

CREATE INDEX IF NOT EXISTS idx_doctor_profiles_type ON public.doctor_profiles(doctor_type);

-- Backfill existing laudistas
UPDATE public.doctor_profiles dp
SET doctor_type = 'laudista'
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = dp.user_id AND ur.role::text = 'laudista'
) AND doctor_type = 'telemedicina';
