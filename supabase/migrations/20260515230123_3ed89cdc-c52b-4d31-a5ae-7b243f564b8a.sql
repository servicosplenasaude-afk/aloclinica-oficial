
-- 1. Drop residual PagBank columns
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS pagbank_subscription_id;
ALTER TABLE public.payment_transactions DROP COLUMN IF EXISTS pagbank_order_id;
ALTER TABLE public.payment_transactions DROP COLUMN IF EXISTS pagbank_charge_id;

-- 2. Add updated_at to subscriptions (fix expire_subscriptions_and_cards)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Rename appointment_waitlist columns to match SQL functions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='appointment_waitlist' AND column_name='preferred_date') THEN
    ALTER TABLE public.appointment_waitlist RENAME COLUMN preferred_date TO desired_date;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='appointment_waitlist' AND column_name='is_notified') THEN
    ALTER TABLE public.appointment_waitlist RENAME COLUMN is_notified TO notified;
  END IF;
END $$;

-- 4. Fix fn_handle_doctor_no_show — use invoke_edge_function helper (correct project URL)
CREATE OR REPLACE FUNCTION public.fn_handle_doctor_no_show()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  appt RECORD;
  new_doctor_id UUID;
  new_doctor_user_id UUID;
BEGIN
  FOR appt IN
    SELECT a.id, a.patient_id, a.doctor_id, a.scheduled_at, a.price_at_booking,
           a.payment_status, a.jitsi_link, a.appointment_type, a.notes
    FROM appointments a
    WHERE a.status IN ('confirmed', 'scheduled')
      AND a.payment_status IN ('confirmed', 'approved', 'received')
      AND a.scheduled_at < now() - interval '30 minutes'
      AND a.scheduled_at > now() - interval '3 hours'
      AND NOT EXISTS (
        SELECT 1 FROM activity_logs al
        WHERE al.entity_id = a.id::text
          AND al.action = 'doctor_no_show_handled'
      )
  LOOP
    UPDATE appointments
    SET status = 'no_show',
        cancel_reason = 'Médico não compareceu — reagendamento automático em andamento',
        cancelled_by = appt.doctor_id::text,
        updated_at = now()
    WHERE id = appt.id;

    INSERT INTO activity_logs (action, entity_type, entity_id, user_id, details)
    VALUES ('doctor_no_show_handled', 'appointment', appt.id, appt.patient_id,
      jsonb_build_object('original_doctor_id', appt.doctor_id, 'scheduled_at', appt.scheduled_at, 'price', appt.price_at_booking)
    );

    SELECT dp.id, dp.user_id INTO new_doctor_id, new_doctor_user_id
    FROM doctor_profiles dp
    WHERE dp.available_now = true AND dp.is_approved = true AND dp.id != appt.doctor_id
    ORDER BY dp.rating DESC NULLS LAST, random()
    LIMIT 1;

    IF new_doctor_id IS NOT NULL AND appt.patient_id IS NOT NULL THEN
      INSERT INTO appointments (
        patient_id, doctor_id, scheduled_at, status, payment_status,
        price_at_booking, appointment_type, notes, original_appointment_id
      ) VALUES (
        appt.patient_id, new_doctor_id, now() + interval '5 minutes',
        'confirmed', appt.payment_status,
        appt.price_at_booking, COALESCE(appt.appointment_type, 'first_visit'),
        'Reatribuído automaticamente — médico anterior não compareceu',
        appt.id
      );

      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (appt.patient_id, '🔄 Consulta reatribuída',
        'O médico anterior não compareceu. Outro profissional foi designado para seu atendimento.',
        'urgent', '/dashboard/consultation');

      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (new_doctor_user_id, '🚨 Paciente aguardando — reatribuição',
        'Um paciente precisa de atendimento imediato.',
        'urgent', '/dashboard/waiting-room');
    ELSE
      IF appt.patient_id IS NOT NULL THEN
        UPDATE appointments
        SET payment_status = 'refund_pending',
            cancel_reason = 'Médico não compareceu — reembolso integral em processamento'
        WHERE id = appt.id;

        PERFORM public.invoke_edge_function(
          'process-refund',
          jsonb_build_object('appointment_id', appt.id::text, 'reason', 'doctor_no_show', 'refund_type', 'full')
        );

        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (appt.patient_id, '💸 Reembolso — Médico não compareceu',
          'Infelizmente o médico não compareceu. Seu reembolso integral será processado automaticamente.',
          'payment', '/dashboard/appointments');
      END IF;
    END IF;

    INSERT INTO notifications (user_id, title, message, type, link)
    SELECT ur.user_id, '⚠️ Médico não compareceu',
      'O médico não compareceu à consulta ' || appt.id || '. Paciente ' || CASE WHEN new_doctor_id IS NOT NULL THEN 'reatribuído.' ELSE 'reembolsado.' END,
      'warning', '/dashboard?tab=appointments'
    FROM user_roles ur WHERE ur.role = 'admin' LIMIT 1;
  END LOOP;
END;
$function$;

-- 5. Fix notify_whatsapp_on_confirmed — use invoke_edge_function helper
CREATE OR REPLACE FUNCTION public.notify_whatsapp_on_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  patient_phone text;
  patient_name text;
  scheduled_date text;
  jitsi text;
  msg text;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed')
     OR (TG_OP = 'INSERT' AND NEW.status = 'confirmed') THEN

    IF NEW.patient_id IS NOT NULL THEN
      SELECT p.phone, p.first_name INTO patient_phone, patient_name
      FROM profiles p WHERE p.user_id = NEW.patient_id;
    ELSIF NEW.guest_patient_id IS NOT NULL THEN
      SELECT gp.phone, gp.full_name INTO patient_phone, patient_name
      FROM guest_patients gp WHERE gp.id = NEW.guest_patient_id;
    END IF;

    IF patient_phone IS NOT NULL AND patient_phone <> '' THEN
      jitsi := COALESCE(NEW.jitsi_link, 'https://meet.jit.si/allo-medico-' || NEW.id::text);
      scheduled_date := to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');

      msg := '🩺 *Allo Médico* - Consulta Confirmada!' || chr(10) || chr(10) ||
             'Olá, ' || COALESCE(patient_name, '') || '!' || chr(10) ||
             'Sua consulta foi agendada para *' || scheduled_date || '*.' || chr(10) || chr(10) ||
             '📹 Link de acesso:' || chr(10) || jitsi || chr(10) || chr(10) ||
             'Acesse o link no horário marcado. Até lá! 💚';

      PERFORM public.invoke_edge_function(
        'send-whatsapp',
        jsonb_build_object('phone', patient_phone, 'message', msg)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
