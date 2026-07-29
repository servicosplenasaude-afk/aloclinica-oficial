-- NFS-e (Nota Fiscal de Serviço): registro/gestão das notas emitidas + colunas de
-- pagamento que faltavam na fila de plantão (on_demand_queue). Idempotente.

-- 1) Tabela de notas fiscais emitidas ------------------------------------------
CREATE TABLE IF NOT EXISTS public.nfse_invoices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref                text NOT NULL UNIQUE,               -- chave de idempotência: "<tipo>_<uuid>"
  resource_type      text NOT NULL,                      -- 'appointment' | 'queue'
  resource_id        uuid,
  patient_id         uuid,
  valor              numeric,
  status             text NOT NULL DEFAULT 'processando',-- processando|autorizado|erro_autorizacao|cancelado
  numero             text,
  codigo_verificacao text,
  pdf_url            text,
  xml_url            text,
  provider           text NOT NULL DEFAULT 'focusnfe',
  error              text,
  raw                jsonb,
  sent_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfse_status   ON public.nfse_invoices (status);
CREATE INDEX IF NOT EXISTS idx_nfse_patient  ON public.nfse_invoices (patient_id);
CREATE INDEX IF NOT EXISTS idx_nfse_resource ON public.nfse_invoices (resource_type, resource_id);

ALTER TABLE public.nfse_invoices ENABLE ROW LEVEL SECURITY;

-- Paciente vê apenas as próprias notas; admin gerencia todas. Emissão é feita pela
-- service_role (edge function), que ignora RLS.
DROP POLICY IF EXISTS "Patients view own nfse" ON public.nfse_invoices;
CREATE POLICY "Patients view own nfse" ON public.nfse_invoices
  FOR SELECT USING (patient_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage nfse" ON public.nfse_invoices;
CREATE POLICY "Admins manage nfse" ON public.nfse_invoices
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_nfse_updated ON public.nfse_invoices;
CREATE TRIGGER trg_nfse_updated BEFORE UPDATE ON public.nfse_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Colunas de pagamento/atendimento da fila de plantão ------------------------
-- A UI de urgência (UrgentCareQueue / DoctorOnDutyPanel) grava/lê estas colunas;
-- estavam ausentes, o que quebrava a entrada na fila (insert com `shift`).
ALTER TABLE public.on_demand_queue
  ADD COLUMN IF NOT EXISTS shift          text,
  ADD COLUMN IF NOT EXISTS payment_id     text,
  ADD COLUMN IF NOT EXISTS paid_at        timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS appointment_id uuid,
  ADD COLUMN IF NOT EXISTS position       integer;
