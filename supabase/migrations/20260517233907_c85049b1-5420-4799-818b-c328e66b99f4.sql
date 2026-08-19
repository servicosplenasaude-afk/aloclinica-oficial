
-- ============================================================
-- 1) DOCTOR_PROFILES: revogar colunas sensíveis de anon/authenticated
-- ============================================================
-- Mantém a policy pública (necessária pro app), mas remove acesso por COLUNA
-- aos campos sensíveis. Apps continuam usando get_public_doctor_profile()
-- e a view doctor_profiles_public (security definer) para o que precisar.

DO $$
DECLARE
  col text;
  sensitive_cols text[] := ARRAY[
    'pix_key',
    'kyc_face_match_score',
    'kyc_verified_at',
    'kyc_session_id',
    'kyc_document_url',
    'kyc_selfie_url',
    'risk_score',
    'auto_pause_reason',
    'auto_paused_at',
    'crm_verified_by',
    'crm_verification_data',
    'cpf',
    'rg',
    'bank_account',
    'bank_agency',
    'bank_code',
    'pix_key_type',
    'price_suggestion_sent_at',
    'churn_flagged_at',
    'phone_personal',
    'address_street',
    'address_zip',
    'tax_id'
  ];
BEGIN
  FOREACH col IN ARRAY sensitive_cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='doctor_profiles' AND column_name=col
    ) THEN
      EXECUTE format('REVOKE SELECT (%I) ON public.doctor_profiles FROM anon, authenticated', col);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 2) REALTIME: RLS por tópico em realtime.messages
-- ============================================================
DO $realtime$
BEGIN
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read own topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can broadcast own topics" ON realtime.messages;

-- Convenção de topics no app: <entidade>:<uuid> (ex: notifications:<user_id>,
-- appointment:<id>, chat:<id>, kyc:<user_id>, queue:<user_id>)
-- Política: usuário só lê/publica em tópicos que contêm seu auth.uid()
-- OU em tópicos de appointments/chats em que ele é participante.

CREATE POLICY "Authenticated can read own topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- tópicos pessoais do próprio usuário
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
  OR
  -- appointment:<uuid> em que é paciente ou médico
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE realtime.topic() = 'appointment:' || a.id::text
      AND (a.patient_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.doctor_profiles dp
                   WHERE dp.id = a.doctor_id AND dp.user_id = auth.uid()))
  )
  OR public.is_admin()
);

CREATE POLICY "Authenticated can broadcast own topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
  OR
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE realtime.topic() = 'appointment:' || a.id::text
      AND (a.patient_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.doctor_profiles dp
                   WHERE dp.id = a.doctor_id AND dp.user_id = auth.uid()))
  )
  OR public.is_admin()
);

EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping realtime.messages policies; table is managed by Supabase';
END
$realtime$;

-- ============================================================
-- 3) STORAGE: policies de DELETE e UPDATE em buckets privados
-- ============================================================
-- Convenção: primeiro segmento do path = user_id (ex: <uid>/file.pdf)

DO $$
DECLARE
  bkt text;
  private_buckets text[] := ARRAY[
    'patient-documents',
    'prescriptions',
    'exam-files',
    'recordings',
    'chat-attachments',
    'exames',
    'laudos-assinados',
    'dicom-bucket',
    'receitas-assinadas'
  ];
BEGIN
  FOREACH bkt IN ARRAY private_buckets LOOP
    -- DELETE: dono ou admin
    EXECUTE format($f$
      DROP POLICY IF EXISTS "Owner or admin can delete %1$s" ON storage.objects;
      CREATE POLICY "Owner or admin can delete %1$s"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = %1$L
        AND (
          auth.uid()::text = (storage.foldername(name))[1]
          OR public.is_admin()
        )
      );
    $f$, bkt);

    -- UPDATE: dono ou admin
    EXECUTE format($f$
      DROP POLICY IF EXISTS "Owner or admin can update %1$s" ON storage.objects;
      CREATE POLICY "Owner or admin can update %1$s"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = %1$L
        AND (
          auth.uid()::text = (storage.foldername(name))[1]
          OR public.is_admin()
        )
      )
      WITH CHECK (
        bucket_id = %1$L
        AND (
          auth.uid()::text = (storage.foldername(name))[1]
          OR public.is_admin()
        )
      );
    $f$, bkt);
  END LOOP;

  -- Backups: só admin pode delete/update
  EXECUTE $b$
    DROP POLICY IF EXISTS "Admin only delete backups" ON storage.objects;
    CREATE POLICY "Admin only delete backups"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'backups' AND public.is_admin());

    DROP POLICY IF EXISTS "Admin only update backups" ON storage.objects;
    CREATE POLICY "Admin only update backups"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'backups' AND public.is_admin())
    WITH CHECK (bucket_id = 'backups' AND public.is_admin());
  $b$;
END $$;
