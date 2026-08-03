-- ============================================================================
-- C1 (CRÍTICO): impede que um médico se AUTOAPROVE.
-- ----------------------------------------------------------------------------
-- Hoje a política de UPDATE de doctor_profiles permite ao médico editar a
-- própria ficha, SEM restringir as colunas de verificação. Assim, qualquer um
-- que se cadastre como "médico" pode marcar crm_verified=true / kyc_status=
-- 'approved' na própria linha e — via gatilhos de auto-aprovação — virar médico
-- listado, agendável e com acesso a prontuário de pacientes, sem verificação real.
--
-- Correção (defensiva, não quebra fluxo legítimo): um gatilho BEFORE UPDATE que,
-- para chamadas de USUÁRIO comum (não-admin), força as colunas de verificação a
-- manterem os valores ANTIGOS. Chamadas do SERVIDOR (service_role → auth.uid()
-- é NULL) e de ADMIN continuam podendo alterar (KYC/aprovação server-side e
-- aprovação manual no painel admin seguem funcionando).
--
-- Observação: NÃO protege `is_active` de propósito (é um toggle de disponibilidade
-- que o médico pode legitimamente alternar; sozinho não aprova/verifica ninguém).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_doctor_verification_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Servidor (service_role, sem usuário) e admin podem alterar verificação.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Usuário comum (o médico editando a própria ficha): mantém a verificação.
  NEW.crm_verified         := OLD.crm_verified;
  NEW.crm_verified_at      := OLD.crm_verified_at;
  NEW.kyc_status           := OLD.kyc_status;
  NEW.kyc_verified_at      := OLD.kyc_verified_at;
  NEW.kyc_face_match_score := OLD.kyc_face_match_score;
  NEW.is_approved          := OLD.is_approved;

  RETURN NEW;
END;
$$;

-- Nome com prefixo 'zzz_' para rodar por ÚLTIMO entre os BEFORE UPDATE
-- (assim reverte qualquer alteração feita por gatilhos de auto-aprovação que
--  tenham disparado a partir da tentativa do próprio médico).
DROP TRIGGER IF EXISTS zzz_protect_doctor_verification ON public.doctor_profiles;
CREATE TRIGGER zzz_protect_doctor_verification
  BEFORE UPDATE ON public.doctor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_doctor_verification_fields();
