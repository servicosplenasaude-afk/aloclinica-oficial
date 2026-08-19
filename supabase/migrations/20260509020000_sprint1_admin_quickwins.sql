-- Sprint 1 — quick wins admin
-- Garante chaves padrão em app_settings + helper RPC para leitura pública

-- ──────────────────────────────────────────────────────────
-- 1. Seed app_settings padrão (idempotente)
-- ──────────────────────────────────────────────────────────
INSERT INTO public.app_settings (key, value) VALUES
  ('maintenance_mode',
    '{"enabled": false, "message": "", "expected_back_at": null, "allow_admin": true}'::jsonb),
  ('seo',
    '{"site_name": "AloClínica", "default_title": "Telemedicina 24h | AloClínica", "default_description": "Consultas médicas online com especialistas, prescrições digitais e laudos médicos.", "twitter_handle": "@aloclinica"}'::jsonb),
  ('robots_txt',
    '{"content": "User-agent: *\nAllow: /\nSitemap: https://aloclinica.com.br/sitemap.xml\n"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 2. RPC pública para ler config de manutenção
--    (front precisa ler ANTES de autenticar)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_maintenance_status()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(value::jsonb, '{"enabled": false}'::jsonb)
    FROM public.app_settings
   WHERE key = 'maintenance_mode'
   LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_maintenance_status() TO anon, authenticated;

-- ──────────────────────────────────────────────────────────
-- 3. Index para activity_logs (busca + filtros)
-- ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_desc ON public.activity_logs (created_at DESC);

-- Trigger updated_at em app_settings (se ainda não existe)
CREATE OR REPLACE FUNCTION public.touch_app_settings()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS app_settings_touch ON public.app_settings;
CREATE TRIGGER app_settings_touch BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings();
