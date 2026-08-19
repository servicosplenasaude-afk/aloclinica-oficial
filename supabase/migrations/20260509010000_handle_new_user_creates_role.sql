-- Atualiza handle_new_user() para também inserir o role do usuário,
-- baseado em raw_user_meta_data->>'role'. Default = 'patient'.
--
-- ANTES: trigger só criava o profile. Sem role, o usuário logava mas
-- ficava sem permissão (todas as RoleGuard travavam). Resultado: front
-- parecia "não conseguir criar conta".
--
-- DEPOIS: trigger cria profile + role atomicamente. Front pode passar
-- role no metadata do signUp (`patient`, `doctor`, `clinic`, etc).
-- Sem metadata, default = 'patient' (mais comum no funil).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
  v_app_role app_role;
BEGIN
  -- 1. Criar profile (mesmo comportamento de antes)
  INSERT INTO public.profiles (
    user_id,
    first_name,
    last_name,
    cpf,
    phone,
    date_of_birth
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cpf',''), '\D', '', 'g'), ''),
    NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'phone',''), '\D', '', 'g'), ''),
    NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- 2. Resolver role (default 'patient')
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'patient');

  -- 3. Validar contra o ENUM app_role; se inválido, usa 'patient'
  BEGIN
    v_app_role := v_role::app_role;
  EXCEPTION WHEN invalid_text_representation THEN
    v_app_role := 'patient'::app_role;
  END;

  -- 4. Inserir role (se já existir, ignorar — usuário pode ter múltiplos roles)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- BACKFILL: usuários existentes sem role (vítimas do bug) recebem 'patient'.
-- Doctors/clinics são raros e identificáveis — devem ser ajustados via admin
-- depois da auditoria, então 'patient' é o default seguro.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'patient'::app_role
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
 WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;
