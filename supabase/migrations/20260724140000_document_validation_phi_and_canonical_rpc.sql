-- Validação pública de documentos: 2 correções.
--
-- (1) PHI LEAK: verify_document_public (SECURITY DEFINER, chamável sem auth)
--     retornava details inteiro, e os documentos gravam conteúdo clínico ali:
--     atestado → { days, cid, reason }; receita → { medications, diagnosis }.
--     CID, motivo e diagnóstico são dados sensíveis (LGPD) e vazavam para
--     qualquer um com o código. Agora a RPC remove essas chaves, mantendo só
--     as não-sensíveis (ex.: days, contagem de medicamentos).
--
-- (2) RPC AUSENTE: as páginas de validação (ValidateDocument, PrescriptionVerification)
--     chamavam validate_signature_public como prioridade 1 (validação ICP-Brasil
--     canônica, CFM 2.299/2021), mas a função NÃO existia — a chamada sempre
--     falhava e caía no fallback, deixando documentos assinados sem validação
--     canônica. Criada retornando SÓ autenticidade (médico, CRM, paciente, data,
--     hash, validade); nunca expõe doctor_cpf, signature_data, storage_path nem
--     public_url.

CREATE OR REPLACE FUNCTION public.verify_document_public(p_code text)
 RETURNS TABLE(verification_code text, document_type text, patient_name text, doctor_name text, doctor_crm text, issued_at timestamp with time zone, details jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT dv.verification_code, dv.document_type, dv.patient_name, dv.doctor_name,
         dv.doctor_crm, dv.created_at AS issued_at,
         (COALESCE(dv.details,'{}'::jsonb) - 'cid' - 'reason' - 'diagnosis') AS details
  FROM public.document_verifications dv WHERE dv.verification_code = p_code LIMIT 1;
$function$;

DROP FUNCTION IF EXISTS public.validate_signature_public(text);

CREATE FUNCTION public.validate_signature_public(p_document_id text)
 RETURNS TABLE(
   document_id text, document_type text, doctor_name text, doctor_crm text,
   patient_name text, signed_at timestamptz, document_hash text,
   certificate_alias text, is_valid boolean, revoked_at timestamptz, revoke_reason text
 )
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(ds.verification_code, ds.related_record_id::text, ds.id::text) AS document_id,
    ds.document_type, ds.doctor_name, ds.doctor_crm, ds.patient_name,
    ds.created_at AS signed_at, ds.document_hash, ds.certificate_alias,
    COALESCE(ds.is_valid, true) AS is_valid,
    NULL::timestamptz AS revoked_at, NULL::text AS revoke_reason
  FROM public.digital_signatures ds
  WHERE ds.verification_code = p_document_id
     OR ds.related_record_id::text = p_document_id
     OR ds.id::text = p_document_id
  LIMIT 1;
$function$;
GRANT EXECUTE ON FUNCTION public.validate_signature_public(text) TO anon, authenticated;
