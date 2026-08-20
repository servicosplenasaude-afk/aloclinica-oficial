-- Enforce the invariant below the RPC as well, so direct REST writes allowed
-- by the legacy admin RLS policies cannot remove the final administrator.
CREATE OR REPLACE FUNCTION public.protect_last_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.role = 'admin'::public.app_role
     AND (TG_OP = 'DELETE' OR NEW.role <> 'admin'::public.app_role) THEN
    PERFORM pg_advisory_xact_lock(hashtext('aloclinica:admin-role-management'));
    IF (SELECT count(*) FROM public.user_roles WHERE role = 'admin'::public.app_role) <= 1 THEN
      RAISE EXCEPTION 'LAST_ADMIN_PROTECTED' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS protect_last_admin_role_trigger ON public.user_roles;
CREATE TRIGGER protect_last_admin_role_trigger
BEFORE DELETE OR UPDATE OF role ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_last_admin_role();

REVOKE ALL ON FUNCTION public.protect_last_admin_role() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.admin_set_user_roles(p_target_user_id uuid, p_roles text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_previous_roles text[];
  v_normalized_roles text[];
  v_role text;
  v_issued_at timestamptz;
BEGIN
  IF v_actor_id IS NULL OR NOT public.has_role(v_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;

  v_issued_at := to_timestamp(COALESCE((auth.jwt() ->> 'iat')::bigint, 0));
  IF v_issued_at < now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'RECENT_AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'TARGET_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT role_name ORDER BY role_name), ARRAY[]::text[])
    INTO v_normalized_roles
  FROM unnest(COALESCE(p_roles, ARRAY[]::text[])) AS role_name
  WHERE role_name <> '';

  FOREACH v_role IN ARRAY v_normalized_roles LOOP
    PERFORM v_role::public.app_role;
  END LOOP;

  PERFORM pg_advisory_xact_lock(hashtext('aloclinica:admin-role-management'));

  SELECT COALESCE(array_agg(role::text ORDER BY role::text), ARRAY[]::text[])
    INTO v_previous_roles
  FROM public.user_roles
  WHERE user_id = p_target_user_id;

  IF 'admin' = ANY(v_previous_roles)
     AND NOT ('admin' = ANY(v_normalized_roles))
     AND (SELECT count(*) FROM public.user_roles WHERE role = 'admin'::public.app_role) <= 1 THEN
    RAISE EXCEPTION 'LAST_ADMIN_PROTECTED' USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = p_target_user_id
    AND NOT (role::text = ANY(v_normalized_roles));

  INSERT INTO public.user_roles (user_id, role)
  SELECT p_target_user_id, role_name::public.app_role
  FROM unnest(v_normalized_roles) AS role_name
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (v_actor_id, 'user_roles.set', 'user_role', p_target_user_id,
    jsonb_build_object('actor_id', v_actor_id, 'target_user_id', p_target_user_id,
      'previous_roles', to_jsonb(v_previous_roles), 'new_roles', to_jsonb(v_normalized_roles)));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_roles(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_roles(uuid, text[]) TO authenticated;
