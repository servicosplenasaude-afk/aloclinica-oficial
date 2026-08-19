-- Sprint 2 — Templates editáveis + Segurança + Termos versionados

-- ──────────────────────────────────────────────────────────
-- 1. notification_templates (email + WhatsApp unificados)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Slug usado pelo código (ex: 'kyc_approved', 'appointment_confirmation')
  slug TEXT NOT NULL,
  -- Canal: 'email' | 'whatsapp' | 'sms' | 'push'
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms', 'push')),
  -- Conteúdo
  subject TEXT,                 -- só email
  body_html TEXT,               -- email = HTML; whatsapp/sms = texto
  body_text TEXT,               -- versão texto puro (fallback)
  -- Metadata
  description TEXT,             -- pra admin entender
  variables JSONB DEFAULT '[]'::jsonb,  -- ["name", "score", ...]
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,  -- protege de delete acidental
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE (slug, channel)
);

CREATE INDEX IF NOT EXISTS idx_notif_templates_slug ON public.notification_templates (slug, channel) WHERE is_active = true;

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manages templates" ON public.notification_templates;
CREATE POLICY "admin manages templates" ON public.notification_templates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "service role full templates" ON public.notification_templates;
CREATE POLICY "service role full templates" ON public.notification_templates
  FOR ALL TO service_role USING (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_notification_templates()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS notif_templates_touch ON public.notification_templates;
CREATE TRIGGER notif_templates_touch BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_notification_templates();

-- Seed dos templates mais críticos (idempotente)
INSERT INTO public.notification_templates (slug, channel, subject, body_html, body_text, description, variables, is_system)
VALUES
  ('kyc_approved', 'email',
   'Identidade verificada — AloClínica',
   '<h2>Olá {{name}}!</h2><p>Sua identidade foi verificada com sucesso.</p><p><strong>Score:</strong> {{score}}%</p><p>Já pode marcar consultas e usar todos os recursos.</p>',
   'Olá {{name}}! Sua identidade foi verificada (score: {{score}}%). Já pode marcar consultas.',
   'Enviado quando a verificação biométrica é aprovada',
   '["name", "score"]'::jsonb,
   true),
  ('kyc_rejected', 'email',
   'Verificação não aprovada — AloClínica',
   '<h2>Olá {{name}}</h2><p>Sua verificação de identidade não foi aprovada (score: {{score}}%).</p><p>Possíveis motivos:</p><ul><li>Foto borrada ou com baixa iluminação</li><li>Documento ilegível</li><li>Rosto não corresponde ao documento</li></ul><p>Tente novamente em <a href="https://aloclinica.com.br/kyc">https://aloclinica.com.br/kyc</a></p>',
   'Olá {{name}}, sua verificação biométrica não foi aprovada (score: {{score}}%). Tente novamente em https://aloclinica.com.br/kyc',
   'Enviado quando a verificação biométrica é recusada',
   '["name", "score"]'::jsonb,
   true),
  ('appointment_confirmation', 'email',
   'Consulta confirmada — {{date}}',
   '<h2>Consulta confirmada!</h2><p>Olá {{patient_name}}, sua consulta com Dr(a). {{doctor_name}} está confirmada.</p><p><strong>Data:</strong> {{date}}</p><p><strong>Link:</strong> <a href="{{link}}">Entrar na consulta</a></p>',
   'Consulta confirmada! Dr(a). {{doctor_name}} em {{date}}. Link: {{link}}',
   'Enviado quando o pagamento de consulta é confirmado',
   '["patient_name", "doctor_name", "date", "link"]'::jsonb,
   true),
  ('refund_processed', 'email',
   'Estorno processado — R$ {{amount}}',
   '<h2>Estorno processado</h2><p>O estorno de <strong>R$ {{amount}}</strong> foi processado.</p><p>O valor deve aparecer na fatura do seu cartão em até 7 dias úteis.</p>{{#if reason}}<p><em>Motivo: {{reason}}</em></p>{{/if}}',
   'Estorno de R$ {{amount}} processado. Aparece na fatura em até 7 dias úteis.',
   'Enviado quando admin estorna uma cobrança',
   '["amount", "reason", "full"]'::jsonb,
   true),
  ('welcome', 'email',
   'Bem-vindo(a) à AloClínica!',
   '<h2>Olá {{name}}!</h2><p>Sua conta na AloClínica foi criada com sucesso.</p><p>Próximos passos:</p><ol><li>Verifique sua identidade (KYC) — obrigatório por lei</li><li>Marque sua primeira consulta</li></ol>',
   'Olá {{name}}! Sua conta foi criada. Próximo passo: verificação de identidade.',
   'Enviado no signup do paciente',
   '["name"]'::jsonb,
   true),
  -- WhatsApp templates
  ('appointment_reminder_24h', 'whatsapp', NULL,
   'Olá {{patient_name}}! 👋\n\nLembrete: você tem consulta amanhã ({{date}}) com Dr(a). {{doctor_name}}.\n\nLink: {{link}}\n\nAté lá! 🩺',
   NULL,
   'Lembrete WhatsApp 24h antes da consulta',
   '["patient_name", "doctor_name", "date", "link"]'::jsonb,
   true),
  ('appointment_starting_soon', 'whatsapp', NULL,
   '🟢 Sua consulta com Dr(a). {{doctor_name}} começa em 5 minutos!\n\nClique aqui pra entrar: {{link}}',
   NULL,
   'Notificação WhatsApp 5min antes da consulta',
   '["doctor_name", "link"]'::jsonb,
   true)
ON CONFLICT (slug, channel) DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 2. notification_log (histórico de envios)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_slug TEXT,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,             -- email, telefone, user_id
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending', 'delivered', 'opened', 'bounced')),
  provider TEXT,                       -- 'brevo', 'evolution', 'waha', etc
  provider_message_id TEXT,
  error TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_user ON public.notification_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_channel ON public.notification_log (channel, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_template ON public.notification_log (template_slug, created_at DESC);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin reads log" ON public.notification_log;
CREATE POLICY "admin reads log" ON public.notification_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "users see own notifs" ON public.notification_log;
CREATE POLICY "users see own notifs" ON public.notification_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service role full notif log" ON public.notification_log;
CREATE POLICY "service role full notif log" ON public.notification_log
  FOR ALL TO service_role USING (true);

-- ──────────────────────────────────────────────────────────
-- 3. failed_login_attempts (segurança)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  reason TEXT,                         -- 'wrong_password', 'user_not_found', 'rate_limited', etc
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_failed_login_email_time ON public.failed_login_attempts (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_failed_login_ip_time ON public.failed_login_attempts (ip_address, created_at DESC);

ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin reads attempts" ON public.failed_login_attempts;
CREATE POLICY "admin reads attempts" ON public.failed_login_attempts
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "service role full failed_login" ON public.failed_login_attempts;
CREATE POLICY "service role full failed_login" ON public.failed_login_attempts
  FOR ALL TO service_role USING (true);

-- View resumida pra dashboard segurança
CREATE OR REPLACE VIEW public.security_dashboard AS
SELECT
  'recent_failed_logins' AS metric,
  COUNT(*)::int AS value,
  '24h' AS window_label
  FROM public.failed_login_attempts
  WHERE created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
  'unique_attacking_ips',
  COUNT(DISTINCT ip_address)::int,
  '24h'
  FROM public.failed_login_attempts
  WHERE created_at >= NOW() - INTERVAL '24 hours'
    AND ip_address IS NOT NULL
UNION ALL
SELECT
  'kyc_attempts_24h',
  COUNT(*)::int,
  '24h'
  FROM public.kyc_verificacoes
  WHERE created_at >= NOW() - INTERVAL '24 hours';

GRANT SELECT ON public.security_dashboard TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 4. user_consent_log (termos versionados)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('terms', 'privacy', 'lgpd', 'telemedicine_consent', 'cookies')),
  version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  UNIQUE (user_id, document_type, version)
);

CREATE INDEX IF NOT EXISTS idx_consent_log_user ON public.user_consent_log (user_id, document_type, version);

ALTER TABLE public.user_consent_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user sees own consents" ON public.user_consent_log;
CREATE POLICY "user sees own consents" ON public.user_consent_log
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "user inserts own consents" ON public.user_consent_log;
CREATE POLICY "user inserts own consents" ON public.user_consent_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "service role full consent_log" ON public.user_consent_log;
CREATE POLICY "service role full consent_log" ON public.user_consent_log
  FOR ALL TO service_role USING (true);

-- Seed das versões atuais em app_settings
INSERT INTO public.app_settings (key, value) VALUES
  ('terms_version',
    '{"version": "1.0", "effective_date": "2026-01-01", "url": "/terms"}'::jsonb),
  ('privacy_version',
    '{"version": "1.0", "effective_date": "2026-01-01", "url": "/privacy"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
