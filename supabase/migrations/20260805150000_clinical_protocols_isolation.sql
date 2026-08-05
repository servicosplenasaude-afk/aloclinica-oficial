-- Isolamento de protocolos clínicos por médico.
-- ANTES: a policy de SELECT expunha TODOS os protocolos ativos a qualquer
-- autenticado, e a policy "FOR ALL" tinha um OR has_role(doctor) que deixava
-- QUALQUER médico editar/excluir protocolos de OUTROS médicos (o auth.uid() =
-- created_by ficava redundante). Corrige para: cada médico vê/gerencia só os
-- seus; protocolos globais (created_by IS NULL, criados por admin) ficam
-- visíveis a todos (somente leitura para não-donos); admin gerencia tudo.
DROP POLICY IF EXISTS "anyone authenticated reads active protocols" ON public.clinical_protocols;
DROP POLICY IF EXISTS "doctor or admin manages own protocols" ON public.clinical_protocols;

CREATE POLICY "read own or global protocols" ON public.clinical_protocols
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR created_by = auth.uid()
    OR created_by IS NULL
  );

CREATE POLICY "manage own protocols" ON public.clinical_protocols
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR auth.uid() = created_by
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR auth.uid() = created_by
  );
