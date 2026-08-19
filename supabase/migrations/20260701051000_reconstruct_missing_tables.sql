-- ============================================================================
-- SCHEMA RECOVERY (2026-07-01)
--
-- The live Supabase project (pwxvvimdtmvziynbspgx) is MISSING several tables
-- that the edge functions read/write. The repo's migrations do NOT create them
-- (they only ALTER/index them, assuming prior existence), and types.ts confirms
-- the DB never had them — i.e. the original CREATE TABLE history was lost when
-- the schema was squashed / moved to this repo. Affected (broken) features:
-- payments, saved cards, digital signatures, affiliate program, discount cards,
-- doctor availability.
--
-- These definitions are RECONSTRUCTED from how the edge functions use each table
-- (column names/types inferred from insert/upsert/select payloads). They are
-- BEST-EFFORT and should be VALIDATED against the original schema before real
-- traffic. Columns are mostly NULLABLE so the app's partial inserts don't fail.
-- RLS is locked down (owner-read; writes happen via the service_role which
-- bypasses RLS). Idempotent (IF NOT EXISTS).
-- ============================================================================

-- 1) payment_transactions — Mercado Pago charge ledger (used by mercadopago-*).
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  gateway           text DEFAULT 'mercadopago',
  mp_payment_id     text,
  mp_preapproval_id text,
  amount_cents      bigint,
  currency          text DEFAULT 'BRL',
  payment_method    text,
  status            text,
  resource_id       text,
  resource_type     text,
  raw_response      jsonb,
  mp_qr_code        text,
  mp_qr_code_base64 text,
  mp_boleto_url     text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_transactions_mp_payment_id
  ON public.payment_transactions (mp_payment_id) WHERE mp_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON public.payment_transactions (user_id);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pt_owner_select ON public.payment_transactions;
CREATE POLICY pt_owner_select ON public.payment_transactions FOR SELECT USING (user_id = auth.uid());

-- 2) saved_cards — tokenized MP cards (vault) per user.
CREATE TABLE IF NOT EXISTS public.saved_cards (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  mp_card_id     text,
  mp_customer_id text,
  brand          text,
  last4          text,
  holder_name    text,
  expiry_month   integer,
  expiry_year    integer,
  is_default     boolean DEFAULT false,
  status         text DEFAULT 'active',
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saved_cards_user ON public.saved_cards (user_id);
ALTER TABLE public.saved_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sc_owner_select ON public.saved_cards;
CREATE POLICY sc_owner_select ON public.saved_cards FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS sc_owner_delete ON public.saved_cards;
CREATE POLICY sc_owner_delete ON public.saved_cards FOR DELETE USING (user_id = auth.uid());

-- 3) digital_signatures — ICP-Brasil / VIDAAS signed-document records.
CREATE TABLE IF NOT EXISTS public.digital_signatures (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider          text,
  certificate_alias text,
  doctor_name       text,
  doctor_crm        text,
  doctor_cpf        text,
  patient_name      text,
  document_type     text,
  related_record_id uuid,
  document_hash     text,
  signature_data    text,
  storage_path      text,
  public_url        text,
  verification_code text,
  is_valid          boolean DEFAULT true,
  created_at        timestamptz DEFAULT now()
);
ALTER TABLE public.digital_signatures
  ADD COLUMN IF NOT EXISTS verification_code text;
CREATE INDEX IF NOT EXISTS idx_digital_signatures_verif ON public.digital_signatures (verification_code);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_record ON public.digital_signatures (related_record_id);
ALTER TABLE public.digital_signatures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ds_owner_select ON public.digital_signatures;
CREATE POLICY ds_owner_select ON public.digital_signatures FOR SELECT USING (user_id = auth.uid());

-- 4) affiliate_profiles — affiliate/referral program (created by assign-role).
CREATE TABLE IF NOT EXISTS public.affiliate_profiles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  pix_key            text,
  commission_percent numeric DEFAULT 2,
  is_approved        boolean DEFAULT false,
  created_at         timestamptz DEFAULT now()
);
ALTER TABLE public.affiliate_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ap_owner_select ON public.affiliate_profiles;
CREATE POLICY ap_owner_select ON public.affiliate_profiles FOR SELECT USING (user_id = auth.uid());

-- 5) discount_cards — Pingo/discount card entitlement per user.
CREATE TABLE IF NOT EXISTS public.discount_cards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status      text DEFAULT 'active',
  valid_until timestamptz,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discount_cards_user ON public.discount_cards (user_id);
ALTER TABLE public.discount_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dc_owner_select ON public.discount_cards;
CREATE POLICY dc_owner_select ON public.discount_cards FOR SELECT USING (user_id = auth.uid());

-- 6) doctor_availability — weekly availability windows per doctor.
CREATE TABLE IF NOT EXISTS public.doctor_availability (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   uuid,
  day_of_week integer,
  start_time  time,
  end_time    time,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doctor_availability_doctor ON public.doctor_availability (doctor_id);
ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;
-- Patients need to read availability to book; doctors manage their own.
DROP POLICY IF EXISTS da_read ON public.doctor_availability;
CREATE POLICY da_read ON public.doctor_availability FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS da_doctor_manage ON public.doctor_availability;
CREATE POLICY da_doctor_manage ON public.doctor_availability FOR ALL USING (
  EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id = doctor_id AND dp.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id = doctor_id AND dp.user_id = auth.uid())
);
