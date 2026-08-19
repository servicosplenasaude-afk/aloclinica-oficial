-- Fecha o ciclo de renovação de receita: colunas em falta + trigger de notificação
-- ao médico responsável quando o paciente submete uma renovação.

ALTER TABLE public.prescription_renewals
  ADD COLUMN IF NOT EXISTS assigned_doctor_id uuid REFERENCES public.doctor_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_prescription_url text,
  ADD COLUMN IF NOT EXISTS health_questionnaire jsonb,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewed_to_prescription_id uuid REFERENCES public.prescriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prescription_renewals_doctor_status
  ON public.prescription_renewals(assigned_doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_prescription_renewals_patient
  ON public.prescription_renewals(patient_id);

-- Trigger: cria notificação para o médico quando uma renovação chega (status pending)
CREATE OR REPLACE FUNCTION public.fn_notify_renewal_request()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  doc_user_id uuid;
  patient_name text;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;

  -- doctor_id em prescription_renewals é o doctor_profiles.id → buscar user_id
  SELECT user_id INTO doc_user_id FROM public.doctor_profiles WHERE id = NEW.assigned_doctor_id;
  IF doc_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), ''), 'um paciente')
    INTO patient_name
    FROM public.profiles WHERE user_id = NEW.patient_id;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    doc_user_id,
    '💊 Pedido de renovação de receita',
    CONCAT(patient_name, ' pediu renovação de uma receita. Toque para revisar e aprovar.'),
    'info',
    '/dashboard/prescription-renewals'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_renewal_request ON public.prescription_renewals;
CREATE TRIGGER trg_notify_renewal_request
  AFTER INSERT ON public.prescription_renewals
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_renewal_request();

NOTIFY pgrst, 'reload schema';
