-- ─── Tabela: aloc_exames ───────────────────────────────────────────────────
CREATE TABLE public.aloc_exames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  medico_solicitante_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  laudista_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo_exame TEXT NOT NULL DEFAULT 'Raio-X',
  status TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando','em_laudo','concluido','entregue')),
  orthanc_study_uid TEXT,
  orthanc_study_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aloc_exames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors see own exams" ON public.aloc_exames
  FOR SELECT TO authenticated
  USING (laudista_id = auth.uid() OR medico_solicitante_id = auth.uid());

CREATE POLICY "Patients see own exams" ON public.aloc_exames
  FOR SELECT TO authenticated
  USING (paciente_id = auth.uid());

CREATE POLICY "Doctors insert exams" ON public.aloc_exames
  FOR INSERT TO authenticated
  WITH CHECK (medico_solicitante_id = auth.uid());

CREATE POLICY "Laudista update assigned exams" ON public.aloc_exames
  FOR UPDATE TO authenticated
  USING (laudista_id = auth.uid())
  WITH CHECK (laudista_id = auth.uid());

CREATE POLICY "Admin full access exams" ON public.aloc_exames
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── Tabela: aloc_laudos ──────────────────────────────────────────────────
CREATE TABLE public.aloc_laudos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exame_id UUID REFERENCES public.aloc_exames(id) ON DELETE CASCADE NOT NULL,
  medico_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  conteudo_html TEXT NOT NULL DEFAULT '',
  conteudo_ia TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','assinado','entregue')),
  assinado_em TIMESTAMPTZ,
  pdf_url TEXT,
  qr_token TEXT UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aloc_laudos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors see own laudos" ON public.aloc_laudos
  FOR SELECT TO authenticated
  USING (medico_id = auth.uid());

CREATE POLICY "Doctors insert own laudos" ON public.aloc_laudos
  FOR INSERT TO authenticated
  WITH CHECK (medico_id = auth.uid());

CREATE POLICY "Doctors update own laudos" ON public.aloc_laudos
  FOR UPDATE TO authenticated
  USING (medico_id = auth.uid())
  WITH CHECK (medico_id = auth.uid());

CREATE POLICY "Patients see signed laudos" ON public.aloc_laudos
  FOR SELECT TO authenticated
  USING (
    status IN ('assinado', 'entregue')
    AND EXISTS (
      SELECT 1 FROM public.aloc_exames e
      WHERE e.id = exame_id AND e.paciente_id = auth.uid()
    )
  );

CREATE POLICY "Admin full access laudos" ON public.aloc_laudos
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── Função pública para validação de laudo via QR ────────────────────────
CREATE OR REPLACE FUNCTION public.validar_laudo_publico(p_token TEXT)
RETURNS TABLE (
  qr_token TEXT,
  status TEXT,
  assinado_em TIMESTAMPTZ,
  tipo_exame TEXT,
  medico_nome TEXT,
  paciente_nome TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.qr_token,
    l.status,
    l.assinado_em,
    e.tipo_exame,
    COALESCE(p_med.first_name || ' ' || p_med.last_name, 'Médico') AS medico_nome,
    COALESCE(p_pac.first_name || ' ' || p_pac.last_name, 'Paciente') AS paciente_nome
  FROM public.aloc_laudos l
  JOIN public.aloc_exames e ON e.id = l.exame_id
  LEFT JOIN public.profiles p_med ON p_med.user_id = l.medico_id
  LEFT JOIN public.profiles p_pac ON p_pac.user_id = e.paciente_id
  WHERE l.qr_token = p_token
  LIMIT 1;
$$;
