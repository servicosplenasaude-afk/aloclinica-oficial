-- PagBank Split: guarda o Account ID do médico no PagBank (para o repasse via
-- split de pagamento). Preenchido quando o médico conectar/cadastrar a conta
-- PagBank dele. Aditiva e nullable — sem médico conectado, o pagamento não faz
-- split (fica com o dono do token da plataforma).
ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS pagbank_account_id text;

COMMENT ON COLUMN public.doctor_profiles.pagbank_account_id IS
  'Account ID do médico no PagBank (ACCO_...), usado no split de pagamento para o repasse. NULL = médico ainda não conectou conta PagBank.';
