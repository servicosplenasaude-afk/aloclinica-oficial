-- Programa de indicação: cada paciente tem um código único; quem se cadastra
-- usando o código recebe R$ 30 de crédito e o indicador também (na 1a consulta
-- paga do indicado).

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  /** Slug curto (~7 chars) compartilhável. Único. */
  code text NOT NULL UNIQUE,
  /** Quantos cadastros usaram (cumulativo). */
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referrer_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0;
UPDATE public.referrals
SET referrer_user_id = COALESCE(referrer_user_id, referrer_id),
    code = COALESCE(code, referral_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_referrals_code ON public.referrals(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner reads own code" ON public.referrals;
CREATE POLICY "owner reads own code" ON public.referrals FOR SELECT USING (auth.uid() = referrer_user_id);
DROP POLICY IF EXISTS "anyone reads code by slug" ON public.referrals;
CREATE POLICY "anyone reads code by slug" ON public.referrals FOR SELECT USING (true);
DROP POLICY IF EXISTS "system writes referrals" ON public.referrals;
CREATE POLICY "system writes referrals" ON public.referrals FOR ALL USING (auth.uid() = referrer_user_id) WITH CHECK (auth.uid() = referrer_user_id);

CREATE TABLE IF NOT EXISTS public.referral_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  /** Crédito do indicado liberado já no cadastro. */
  referee_credit_brl numeric(10,2) NOT NULL DEFAULT 30,
  /** Crédito do indicador, liberado quando o indicado conclui a primeira consulta paga. */
  referrer_credit_brl numeric(10,2) NOT NULL DEFAULT 30,
  referrer_credit_unlocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_user_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_uses_ref ON public.referral_uses(referral_id);
ALTER TABLE public.referral_uses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referrer reads own uses" ON public.referral_uses;
CREATE POLICY "referrer reads own uses" ON public.referral_uses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.referrals r WHERE r.id = referral_id AND r.referrer_user_id = auth.uid())
);
DROP POLICY IF EXISTS "referred reads own use" ON public.referral_uses;
CREATE POLICY "referred reads own use" ON public.referral_uses FOR SELECT USING (auth.uid() = referred_user_id);

-- Função: gera código curto, base32 sem ambiguidades (sem 0/O/1/I)
CREATE OR REPLACE FUNCTION public.fn_generate_referral_code(p_len int DEFAULT 7)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int := 0;
BEGIN
  FOR i IN 1..p_len LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Trigger: ao receber INSERT em referrals sem code, gera um único
CREATE OR REPLACE FUNCTION public.fn_assign_referral_code()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  candidate text;
  tries int := 0;
BEGIN
  IF NEW.code IS NOT NULL AND length(NEW.code) > 0 THEN RETURN NEW; END IF;
  LOOP
    candidate := public.fn_generate_referral_code(7);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referrals WHERE code = candidate);
    tries := tries + 1;
    IF tries > 20 THEN RAISE EXCEPTION 'failed to generate unique referral code'; END IF;
  END LOOP;
  NEW.code := candidate;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_referral_code ON public.referrals;
CREATE TRIGGER trg_assign_referral_code BEFORE INSERT ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.fn_assign_referral_code();

-- Trigger: ao primeiro appointment concluído + payment approved do indicado,
-- libera o crédito do indicador.
CREATE OR REPLACE FUNCTION public.fn_unlock_referrer_credit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.payment_status = 'approved'
     AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.payment_status IS DISTINCT FROM NEW.payment_status) THEN
    UPDATE public.referral_uses
       SET referrer_credit_unlocked = true
     WHERE referred_user_id = NEW.patient_id
       AND referrer_credit_unlocked = false;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_unlock_referrer_credit ON public.appointments;
CREATE TRIGGER trg_unlock_referrer_credit AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.fn_unlock_referrer_credit();

NOTIFY pgrst, 'reload schema';
