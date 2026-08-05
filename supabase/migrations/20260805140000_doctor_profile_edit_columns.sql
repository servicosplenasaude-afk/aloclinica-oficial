-- O perfil do médico (src/components/profile/UserProfile.tsx) lia e gravava
-- colunas que NÃO existiam na tabela base doctor_profiles:
--   education, experience_years, short_description  → só existiam no view
--     doctor_profiles_public como NULL fixo (nunca havia onde salvar);
--   show_in_directory, auto_confirm_bookings        → não existiam em lugar nenhum.
-- Resultado: o SELECT dava 400 (perfil não carregava) e o UPDATE falhava
-- silenciosamente. Adiciona as colunas de forma ADITIVA e idempotente.
ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS education text,
  ADD COLUMN IF NOT EXISTS experience_years integer,
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS show_in_directory boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_confirm_bookings boolean NOT NULL DEFAULT true;
