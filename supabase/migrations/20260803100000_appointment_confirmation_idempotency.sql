-- A5: idempotência da confirmação de consulta.
-- A função edge `appointment-confirmed` é chamada pelo trigger de status E pelo
-- webhook do Mercado Pago (que reenvia notificações) → sem controle, o paciente
-- recebia e-mail/WhatsApp DUPLICADOS. Esta coluna permite um claim atômico:
-- só a primeira chamada preenche `confirmation_sent_at` e envia; as demais pulam.
-- Aditiva e nullable — não afeta dados existentes.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;

COMMENT ON COLUMN public.appointments.confirmation_sent_at IS
  'Quando a confirmação (e-mail/WhatsApp/in-app) foi enviada. Usado como claim de idempotência pela função appointment-confirmed. NULL = ainda não enviada.';
