-- ============================================================================
-- Automation: triggers + pg_cron schedules to fire edge functions automatically
-- ============================================================================
-- - Appointment created/confirmed -> appointment-confirmed (email + WhatsApp)
-- - Appointment completed -> post-consultation-survey (NPS)
-- - Cron every 5min -> appointment-reminders (24h, 48h, 1h, 30min, 15min before)
-- - Cron every 10min -> scheduled-tasks (no-show, expirations)
-- - Cron monthly day 1 03:00 -> generate-sweepstake-tickets
-- - Cron daily 09:00 -> notify-expired-prescriptions

-- pg_cron and pg_net are managed by Supabase and already enabled on hosted
-- projects. Re-creating them here can fail because their privileges are owned
-- by the platform role.

-- Helper: invoke edge function via pg_net.http_post.
-- Edge functions must be deployed with --no-verify-jwt (already in deploy.yml)
-- so they accept calls without Authorization header (internal SUPABASE_SERVICE_ROLE_KEY is used by the function).
CREATE OR REPLACE FUNCTION public.invoke_edge_function(fn_name text, payload jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  request_id bigint;
  base_url text := current_setting('app.settings.supabase_url', true);
BEGIN
  IF base_url IS NULL OR base_url = '' THEN
    RAISE WARNING 'app.settings.supabase_url is not configured; skipping edge invocation';
    RETURN NULL;
  END IF;
  base_url := rtrim(base_url, '/') || '/functions/v1/';
  SELECT net.http_post(
    url := base_url || fn_name,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload,
    timeout_milliseconds := 30000
  ) INTO request_id;
  RETURN request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'invoke_edge_function(%) failed: %', fn_name, SQLERRM;
  RETURN NULL;
END $$;

-- ─── Appointment status triggers ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.on_appointment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Created as scheduled or confirmed
  IF TG_OP = 'INSERT' AND NEW.status IN ('scheduled','confirmed','paid') THEN
    PERFORM public.invoke_edge_function(
      'appointment-confirmed',
      jsonb_build_object('appointment_id', NEW.id::text)
    );
  END IF;

  -- Status transitioned to confirmed (after payment etc)
  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.status,'') NOT IN ('confirmed','paid')
     AND NEW.status IN ('confirmed','paid') THEN
    PERFORM public.invoke_edge_function(
      'appointment-confirmed',
      jsonb_build_object('appointment_id', NEW.id::text)
    );
  END IF;

  -- Completed → trigger NPS survey (post-consultation-survey)
  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.status,'') != 'completed'
     AND NEW.status = 'completed' THEN
    PERFORM public.invoke_edge_function(
      'post-consultation-survey',
      jsonb_build_object('appointment_id', NEW.id::text)
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_appointment_status_automations ON public.appointments;
CREATE TRIGGER trg_appointment_status_automations
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.on_appointment_status_change();

-- ─── pg_cron schedules ──────────────────────────────────────────────────────
DO $$
BEGIN
  -- appointment reminders (5min granularity catches all windows: 24h, 48h, 1h, 30m, 15m)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'appointment-reminders') THEN
    PERFORM cron.unschedule('appointment-reminders');
  END IF;
  PERFORM cron.schedule(
    'appointment-reminders',
    '*/5 * * * *',
    $cron$ SELECT public.invoke_edge_function('appointment-reminders', '{}'::jsonb); $cron$
  );

  -- scheduled tasks (no-show marking, subscription expirations)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduled-tasks') THEN
    PERFORM cron.unschedule('scheduled-tasks');
  END IF;
  PERFORM cron.schedule(
    'scheduled-tasks',
    '*/10 * * * *',
    $cron$ SELECT public.invoke_edge_function('scheduled-tasks', '{}'::jsonb); $cron$
  );

  -- monthly sweepstake ticket generation (1st day of each month at 03:00)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-sweepstake-tickets') THEN
    PERFORM cron.unschedule('generate-sweepstake-tickets');
  END IF;
  PERFORM cron.schedule(
    'generate-sweepstake-tickets',
    '0 3 1 * *',
    $cron$ SELECT public.invoke_edge_function('generate-sweepstake-tickets', '{}'::jsonb); $cron$
  );

  -- daily expired prescriptions notification (09:00)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-expired-prescriptions') THEN
    PERFORM cron.unschedule('notify-expired-prescriptions');
  END IF;
  PERFORM cron.schedule(
    'notify-expired-prescriptions',
    '0 9 * * *',
    $cron$ SELECT public.invoke_edge_function('notify-expired-prescriptions', '{}'::jsonb); $cron$
  );
END $$;
