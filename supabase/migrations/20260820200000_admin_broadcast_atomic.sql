-- Atomic, idempotent delivery for administrator broadcasts.
CREATE TABLE IF NOT EXISTS public.admin_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key uuid NOT NULL UNIQUE,
  actor_id uuid NOT NULL,
  audience text NOT NULL CHECK (audience IN ('all','patient','doctor','clinic','subscribers')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_broadcasts FROM PUBLIC, anon, authenticated;

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS broadcast_id uuid REFERENCES public.admin_broadcasts(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_broadcast_user
  ON public.notifications(broadcast_id, user_id) WHERE broadcast_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_admin_broadcast_deliver(
  p_idempotency_key uuid, p_actor_id uuid, p_audience text,
  p_title text, p_message text, p_link text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_broadcast_id uuid;
  v_candidates integer := 0;
  v_eligible integer := 0;
  v_existing jsonb;
  v_inserted integer := 0;
BEGIN
  IF p_audience NOT IN ('all','patient','doctor','clinic','subscribers') THEN RAISE EXCEPTION 'invalid audience'; END IF;
  IF length(trim(p_title)) NOT BETWEEN 1 AND 120 OR length(trim(p_message)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid content'; END IF;
  IF p_link IS NOT NULL AND (p_link NOT LIKE '/%' OR p_link LIKE '//%') THEN RAISE EXCEPTION 'invalid link'; END IF;

  INSERT INTO public.admin_broadcasts(idempotency_key, actor_id, audience)
  VALUES (p_idempotency_key, p_actor_id, p_audience)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_broadcast_id;
  IF v_broadcast_id IS NULL THEN
    SELECT result INTO v_existing FROM public.admin_broadcasts WHERE idempotency_key = p_idempotency_key;
    RETURN v_existing || jsonb_build_object('idempotent_replay', true);
  END IF;

  WITH candidates AS (
    SELECT user_id FROM public.profiles WHERE p_audience = 'all'
    UNION SELECT user_id FROM public.user_roles WHERE role::text = p_audience AND p_audience IN ('patient','doctor','clinic')
    UNION SELECT user_id FROM public.push_subscriptions WHERE p_audience = 'subscribers'
  ) SELECT count(DISTINCT user_id) INTO v_candidates FROM candidates;

  WITH candidates AS (
    SELECT user_id FROM public.profiles WHERE p_audience = 'all'
    UNION SELECT user_id FROM public.user_roles WHERE role::text = p_audience AND p_audience IN ('patient','doctor','clinic')
    UNION SELECT user_id FROM public.push_subscriptions WHERE p_audience = 'subscribers'
  ), eligible AS (
    SELECT DISTINCT c.user_id FROM candidates c
    LEFT JOIN public.notification_preferences np ON np.user_id = c.user_id
    WHERE (np.prefs->>'announcement') IS DISTINCT FROM 'false'
      AND (p_audience <> 'subscribers' OR (np.prefs->>'channel_push') IS DISTINCT FROM 'false')
  )
  INSERT INTO public.notifications(user_id, title, message, type, link, broadcast_id)
  SELECT user_id, trim(p_title), trim(p_message), 'announcement', NULLIF(p_link, ''), v_broadcast_id FROM eligible;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  v_eligible := v_inserted;

  v_existing := jsonb_build_object(
    'success', true, 'audience', p_audience, 'candidates', v_candidates,
    'eligible', v_eligible, 'opted_out', v_candidates - v_eligible, 'inserted', v_inserted
  );
  UPDATE public.admin_broadcasts SET result = v_existing WHERE id = v_broadcast_id;
  INSERT INTO public.activity_logs(user_id, performed_by, action, entity_type, entity_id, details)
  VALUES (p_actor_id, p_actor_id, 'admin_broadcast_sent', 'notification', v_broadcast_id,
    jsonb_build_object('audience', p_audience, 'candidates', v_candidates, 'eligible', v_eligible,
      'opted_out', v_candidates - v_eligible, 'inserted', v_inserted, 'has_link', p_link IS NOT NULL));
  RETURN v_existing;
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_admin_broadcast_deliver(uuid,uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_broadcast_deliver(uuid,uuid,text,text,text,text) TO service_role;
