-- Completa apenas cadastros OAuth Google recentes e somente para papéis públicos
-- de auto-registro. Contas antigas e papéis privilegiados não podem ser alterados.
CREATE OR REPLACE FUNCTION public.complete_google_oauth_signup(p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
  v_user auth.users;
  v_role public.app_role;
  v_existing_roles text[];
  v_full_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF lower(COALESCE(p_role, '')) NOT IN ('patient', 'doctor', 'clinic') THEN
    RAISE EXCEPTION 'ROLE_NOT_ALLOWED';
  END IF;
  v_role := lower(p_role)::public.app_role;

  SELECT * INTO v_user FROM auth.users WHERE id = auth.uid() FOR UPDATE;
  IF v_user.id IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF v_user.created_at < now() - interval '30 minutes' THEN
    RAISE EXCEPTION 'SIGNUP_WINDOW_EXPIRED';
  END IF;
  IF COALESCE(v_user.raw_app_meta_data->>'provider', '') <> 'google'
     AND NOT (COALESCE(v_user.raw_app_meta_data->'providers', '[]'::jsonb) ? 'google') THEN
    RAISE EXCEPTION 'GOOGLE_IDENTITY_REQUIRED';
  END IF;

  SELECT COALESCE(array_agg(role::text), ARRAY[]::text[]) INTO v_existing_roles
  FROM public.user_roles WHERE user_id = auth.uid();
  IF EXISTS (SELECT 1 FROM unnest(v_existing_roles) r WHERE r NOT IN ('patient', p_role)) THEN
    RAISE EXCEPTION 'EXISTING_ROLE_CONFLICT';
  END IF;

  IF v_role <> 'patient'::public.app_role THEN
    DELETE FROM public.user_roles WHERE user_id = auth.uid() AND role = 'patient'::public.app_role;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  v_full_name := COALESCE(v_user.raw_user_meta_data->>'full_name', v_user.raw_user_meta_data->>'name', '');
  UPDATE public.profiles
  SET first_name = COALESCE(NULLIF(first_name, ''), NULLIF(v_user.raw_user_meta_data->>'given_name', ''), NULLIF(split_part(v_full_name, ' ', 1), '')),
      last_name = COALESCE(NULLIF(last_name, ''), NULLIF(v_user.raw_user_meta_data->>'family_name', ''), NULLIF(regexp_replace(v_full_name, '^\S+\s*', ''), '')),
      updated_at = now()
  WHERE user_id = auth.uid();
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_google_oauth_signup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_google_oauth_signup(text) TO authenticated;
