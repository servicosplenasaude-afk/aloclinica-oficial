-- PHI (Storage): o bucket 'recordings' (gravações de consulta — vídeo, altamente
-- sensível) tinha leitura liberada para QUALQUER médico (has_role(doctor)), sem
-- escopo — um médico podia ler a gravação de consultas de outros médicos/pacientes.
-- As políticas de update/delete já eram dono-only (foldername[1] = auth.uid()), o
-- que confirma a convenção de path <uid_do_medico>/...
--
-- Correção: leitura passa a ser do DONO (médico que gravou, prefixo do path) ou
-- admin — consistente com update/delete. (Bucket vazio hoje: risco zero. Acesso do
-- paciente à própria gravação, quando a feature for ao ar, deve ser mediado por
-- edge function que valida a posse da consulta, já que o path é prefixado pelo médico.)
DROP POLICY IF EXISTS "Doctors view recordings" ON storage.objects;
CREATE POLICY "Doctors view recordings" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'recordings'
         AND (((auth.uid())::text = (storage.foldername(name))[1]) OR is_admin()));
