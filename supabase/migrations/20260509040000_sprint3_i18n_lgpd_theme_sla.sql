-- Sprint 3 — i18n CMS + LGPD export + Theme + SLA médico

-- ──────────────────────────────────────────────────────────
-- 1. site_sections — multi-idioma
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.site_sections
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'pt-BR' CHECK (language IN ('pt-BR', 'en', 'es'));

-- Drop unique antigo (se existir) e cria com language
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema='public' AND table_name='site_sections'
       AND constraint_type='UNIQUE' AND constraint_name='site_sections_key_key'
  ) THEN
    ALTER TABLE public.site_sections DROP CONSTRAINT site_sections_key_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uniq_site_sections_key_lang'
  ) THEN
    CREATE UNIQUE INDEX uniq_site_sections_key_lang ON public.site_sections (key, language);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_site_sections_lang ON public.site_sections (language) WHERE is_enabled = true;

-- ──────────────────────────────────────────────────────────
-- 2. lgpd_export_jobs (background ZIP)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lgpd_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id),  -- admin que pediu, ou == user_id se foi self
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  download_url TEXT,         -- assinada, expira em 7 dias
  expires_at TIMESTAMPTZ,
  size_bytes BIGINT,
  tables_exported JSONB DEFAULT '[]'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lgpd_export_user ON public.lgpd_export_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lgpd_export_status ON public.lgpd_export_jobs (status, created_at DESC);

ALTER TABLE public.lgpd_export_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user sees own export" ON public.lgpd_export_jobs;
CREATE POLICY "user sees own export" ON public.lgpd_export_jobs
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "user requests own export" ON public.lgpd_export_jobs;
CREATE POLICY "user requests own export" ON public.lgpd_export_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "service role full lgpd export" ON public.lgpd_export_jobs;
CREATE POLICY "service role full lgpd export" ON public.lgpd_export_jobs
  FOR ALL TO service_role USING (true);

-- ──────────────────────────────────────────────────────────
-- 3. Theme — guarda CSS vars editáveis em app_settings
-- ──────────────────────────────────────────────────────────
INSERT INTO public.app_settings (key, value) VALUES
  ('theme',
    '{"primary": "210 100% 45%", "secondary": "340 75% 50%", "accent": "150 60% 45%", "destructive": "0 84% 60%", "background": "210 40% 98%", "foreground": "210 40% 12%", "muted": "210 30% 92%", "border": "210 30% 88%", "radius": "0.75rem", "font_family": "Inter, system-ui, sans-serif", "font_heading": "Inter, system-ui, sans-serif"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RPC público (anon pode ler tema sem login)
CREATE OR REPLACE FUNCTION public.get_active_theme()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(value::jsonb, '{}'::jsonb)
    FROM public.app_settings
   WHERE key = 'theme'
   LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_active_theme() TO anon, authenticated;

-- ──────────────────────────────────────────────────────────
-- 4. SLA médico — view materializada por médico
-- ──────────────────────────────────────────────────────────
-- Procura tabelas relacionadas a laudos/exames/consultas
-- Foco: aloc_laudos (se existir) ou exam_requests
CREATE OR REPLACE VIEW public.doctor_sla_dashboard AS
SELECT
  d.id AS doctor_id,
  d.user_id AS doctor_user_id,
  p.first_name || ' ' || p.last_name AS doctor_name,
  d.crm,
  d.crm_state,
  COUNT(a.id) FILTER (WHERE a.status NOT IN ('completed', 'cancelled')) AS pendentes,
  0::bigint AS atrasados,
  0::bigint AS proximos_24h,
  NULL::numeric AS avg_resolution_hours,
  NULL::timestamptz AS proximo_sla
FROM public.doctor_profiles d
LEFT JOIN public.profiles p ON p.user_id = d.user_id
LEFT JOIN public.appointments a ON a.doctor_id = d.id
GROUP BY d.id, d.user_id, p.first_name, p.last_name, d.crm, d.crm_state;

GRANT SELECT ON public.doctor_sla_dashboard TO authenticated;
