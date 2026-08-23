# Guia de Instalação Completa — AloClínica

Passo a passo para levantar a plataforma **do zero até o ar**, incluindo todos os
serviços externos e auto-hospedados de que ela depende.

- **Revisado em:** 2026-08-23, contra o conteúdo deste repositório (branch `main`).
- **Fonte de verdade:** o código. Onde este guia diverge de documentos antigos
  (`GO-LIVE.md`, `CHECKLIST_CONFIGURACAO.md`, `ARCHITECTURE.md`), a divergência está
  registrada no [Anexo C](#anexo-c--achados-da-revisão-do-repositório).
- **Decisão de go-live:** este guia instala. Quem autoriza o lançamento é a
  [`READINESS_MATRIX.md`](READINESS_MATRIX.md).

> ⚠️ **Regra de ouro:** nenhum segredo (`ACCESS_TOKEN`, `SERVICE_ROLE_KEY`, `API_KEY`)
> entra no frontend. Tudo que é `VITE_*` vira texto legível dentro do bundle JS.
> Segredo só em **Supabase → Edge Functions → Secrets**, **GitHub Secrets** ou no cofre do servidor.

---

## Índice

1. [Mapa dos serviços](#1-mapa-dos-serviços)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Etapa 1 — Código e ambiente local](#3-etapa-1--código-e-ambiente-local)
4. [Etapa 2 — Supabase (banco, auth, storage)](#4-etapa-2--supabase-banco-auth-storage)
5. [Etapa 3 — Edge Functions e secrets](#5-etapa-3--edge-functions-e-secrets)
6. [Etapa 4 — Conta admin (bootstrap)](#6-etapa-4--conta-admin-bootstrap)
7. [Etapa 5 — E-mail (Brevo)](#7-etapa-5--e-mail-brevo)
8. [Etapa 6 — Pagamentos (Mercado Pago / PagBank)](#8-etapa-6--pagamentos-mercado-pago--pagbank)
9. [Etapa 7 — Vídeo (MiroTalk + coturn)](#9-etapa-7--vídeo-mirotalk--coturn)
10. [Etapa 8 — KYC facial (CompreFace + anti-spoof)](#10-etapa-8--kyc-facial-compreface--anti-spoof)
11. [Etapa 9 — WhatsApp (Evolution API)](#11-etapa-9--whatsapp-evolution-api)
12. [Etapa 10 — Push notifications (VAPID)](#12-etapa-10--push-notifications-vapid)
13. [Etapa 11 — Prescrição e assinatura digital](#13-etapa-11--prescrição-e-assinatura-digital)
14. [Etapa 12 — Nota fiscal (NFS-e / Focus NFe)](#14-etapa-12--nota-fiscal-nfs-e--focus-nfe)
15. [Etapa 13 — IA clínica (Anthropic)](#15-etapa-13--ia-clínica-anthropic)
16. [Etapa 14 — Validação de CRM](#16-etapa-14--validação-de-crm)
17. [Etapa 15 — Observabilidade (Sentry)](#17-etapa-15--observabilidade-sentry)
18. [Etapa 16 — Frontend em produção (Cloudflare Pages / VPS)](#18-etapa-16--frontend-em-produção-cloudflare-pages--vps)
19. [Etapa 17 — DNS, TLS e subdomínios de tenant](#19-etapa-17--dns-tls-e-subdomínios-de-tenant)
20. [Etapa 18 — CI/CD (GitHub Actions)](#20-etapa-18--cicd-github-actions)
21. [Etapa 19 — Backup e recuperação](#21-etapa-19--backup-e-recuperação)
22. [Etapa 20 — Apps móveis (Capacitor)](#22-etapa-20--apps-móveis-capacitor)
23. [Etapa 21 — Ambiente sandbox](#23-etapa-21--ambiente-sandbox)
24. [Validação final ponta a ponta](#24-validação-final-ponta-a-ponta)
25. [Anexo A — Todas as variáveis](#anexo-a--todas-as-variáveis)
26. [Anexo B — Ordem mínima para o MVP no ar](#anexo-b--ordem-mínima-para-o-mvp-no-ar)
27. [Anexo C — Achados da revisão do repositório](#anexo-c--achados-da-revisão-do-repositório)

---

## 1. Mapa dos serviços

A plataforma é um SPA React servido por CDN, um backend Supabase (Postgres + Auth +
Storage + 90 Edge Functions Deno) e um conjunto de serviços auto-hospedados num VPS.

```
Navegador / App Capacitor
      │ HTTPS
      ▼
Frontend SPA (React/Vite)  ──  Cloudflare Pages (ou nginx no VPS)
      │ supabase-js (JWT + RLS)
      ▼
Supabase ── Postgres (RLS) · Auth · Storage · Edge Functions (Deno) · pg_cron · pg_net
      │
      ├── Mercado Pago / PagBank ....... pagamento e split
      ├── Brevo ........................ e-mail transacional e de autenticação
      ├── MiroTalk + coturn ............ vídeo WebRTC e TURN
      ├── CompreFace + anti-spoof ...... KYC facial (exigência CFM)
      ├── Evolution API ................ WhatsApp
      ├── Memed / VIDAAS / DocuSeal .... prescrição e assinatura ICP-Brasil
      ├── Focus NFe .................... NFS-e
      ├── Anthropic .................... IA clínica e triagem
      └── Sentry ....................... erros do frontend
```

### 1.1 Tabela de serviços

| # | Serviço | Para quê | Necessidade | Onde roda | Custo típico |
|---|---|---|---|---|---|
| 1 | **Supabase** | Banco, auth, storage, functions, cron | **Bloqueante** | SaaS gerenciado | Free → Pro US$ 25/mês |
| 2 | **Host do frontend** (Cloudflare Pages **ou** Docker/nginx no VPS) | Servir o SPA | **Bloqueante** | SaaS ou VPS | Pages free |
| 3 | **DNS** (Cloudflare) | Domínio, TLS, wildcard de tenant | **Bloqueante** | SaaS | domínio ~R$ 40/ano |
| 4 | **Brevo** | E-mail de confirmação, reset de senha, recibos | **Bloqueante** — sem ele ninguém confirma cadastro | SaaS | free 300/dia |
| 5 | **Mercado Pago** | PIX, cartão, assinatura, split do médico | **Bloqueante** para cobrar | SaaS | % por transação |
| 6 | **MiroTalk** | Sala de vídeo da teleconsulta | **Bloqueante** para consultar | VPS (Docker) | VPS |
| 7 | **coturn** | TURN/STUN — vídeo atrás de NAT/firewall | **Bloqueante na prática** | VPS (Docker, host network) | VPS |
| 8 | **CompreFace** | KYC facial (CFM 2.314/2022 exige identificar o paciente) | **Bloqueante regulatório** | VPS (Docker, ~4 GB RAM) | VPS |
| 9 | **anti-spoof** (`antispoof-service/`) | Detecta foto/tela/máscara no KYC | Recomendado | VPS (Docker) | VPS |
| 10 | **Anthropic** | Leitura do documento no KYC, Pingo, triagem | Recomendado (o KYC usa) | SaaS | por uso |
| 11 | **Sentry** | Erros do frontend em produção | Recomendado | SaaS | free |
| 12 | **Evolution API** | Lembretes e avisos por WhatsApp | Opcional | VPS (Docker) | VPS |
| 13 | **Push (VAPID)** | Notificação web/PWA | Opcional | par de chaves | grátis |
| 14 | **Memed** | Prescrição com assinatura ICP-Brasil | Opcional, mas é o caminho legal da receita | SaaS | comercial |
| 15 | **VIDAAS / DocuSeal** | Assinatura de documentos e contratos | Opcional | SaaS / VPS | comercial |
| 16 | **Focus NFe** | Emissão automática de NFS-e | Opcional tecnicamente, obrigatório fiscalmente | SaaS | por nota |
| 17 | **PagBank** | Gateway alternativo ao Mercado Pago | Opcional | SaaS | % |
| 18 | **Metered.live** | TURN gerenciado como camada extra | Opcional | SaaS | por uso |
| 19 | **InfoSimples / ConsultaCRM** | Validação automática do CRM do médico | Opcional (fallback é manual) | SaaS | por consulta |
| 20 | **GitHub Actions** | CI, deploy, rollback | Recomendado | SaaS | free |

> **Fail-closed × dormente.** Webhooks e endpoints internos **recusam** a requisição se
> o segredo faltar (proposital). Já NFS-e, WhatsApp, push, Memed e anti-spoof ficam
> **dormentes** — não emitem, mas também não quebram o pagamento nem a consulta.

---

## 2. Pré-requisitos

### 2.1 Ferramentas na máquina

| Ferramenta | Versão | Para quê |
|---|---|---|
| Node.js | **20+** | build e dev do frontend |
| npm | 10+ | `npm ci`, scripts |
| Git | qualquer | clonar o repositório |
| Supabase CLI | latest | migrations e deploy de functions |
| Docker + Docker Compose | 24+ | serviços do VPS |
| Android Studio | opcional | build Android |
| macOS + Xcode 15+ | opcional | build iOS (**não há caminho no Windows**) |

```bash
npm install -g supabase        # ou use npx supabase <cmd>
supabase --version
node -v                        # precisa ser >= 20
```

### 2.2 Contas a criar antes de começar

Supabase · Cloudflare (DNS + Pages) · Mercado Pago (conta PJ) · Brevo · Sentry ·
Anthropic · GitHub · e, se for usar: Memed, Focus NFe, PagBank, Metered, InfoSimples.

### 2.3 Servidor

Os serviços auto-hospedados (MiroTalk, coturn, CompreFace, anti-spoof, Evolution API)
precisam de um VPS Linux. **Mínimo realista: 8 GB de RAM** — só o CompreFace reserva
~3,9 GB nos limites de `compreface/docker-compose.yml`. O ambiente atual roda
Ubuntu 24.04 + EasyPanel + Traefik.

---

## 3. Etapa 1 — Código e ambiente local

```bash
git clone https://github.com/servicosplenasaude-afk/aloclinica-oficial.git
cd aloclinica
npm ci
cp .env.example .env
npm run dev                    # http://localhost:8080
```

Preencha o `.env` — todas as chaves aqui são **públicas** por natureza:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_APP_URL=https://aloclinica.com.br
VITE_SENTRY_DSN=
VITE_MERCADOPAGO_PUBLIC_KEY=APP_USR-...
VITE_VAPID_PUBLIC_KEY=
VITE_MIROTALK_URL=https://meet.seudominio
VITE_WHATSAPP_GATEWAY_URL=https://whatsapp.seudominio
VITE_COMPREFACE_URL=https://face.seudominio
```

> ⚠️ Se `VITE_SUPABASE_URL` ficar vazio, `src/lib/supabase-config.ts` cai num **default
> embutido apontando para o projeto de produção** (`pwxvvimdtmvziynbspgx`). Em
> desenvolvimento isso significa mexer em dados reais sem perceber. Sempre preencha.

### 3.1 Verificações de qualidade

```bash
npx tsc --noEmit -p tsconfig.app.json   # tipos
npm run lint                            # ESLint
npm test                                # Vitest
npm run test:e2e                        # Playwright (precisa do app rodando)
npm run build                           # build de produção
```

---

## 4. Etapa 2 — Supabase (banco, auth, storage)

### 4.1 Criar o projeto

1. https://supabase.com/dashboard → **New project**.
2. Região **South America (São Paulo)** — latência e LGPD.
3. Guarde a senha do Postgres num cofre; ela não é exibida de novo.
4. Anote em **Settings → API**:
   - `Project URL` → vira `VITE_SUPABASE_URL`
   - `anon / publishable key` → vira `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `service_role key` → **segredo**, nunca no frontend
   - `Project ref` (ex.: `pwxvvimdtmvziynbspgx`)
5. Em **Account → Access Tokens**, gere um token `sbp_...` para o CLI e o CI.

### 4.2 Conectar o CLI

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...        # PowerShell: $env:SUPABASE_ACCESS_TOKEN="sbp_..."
supabase login
supabase link --project-ref <SEU_REF>
```

> `supabase/config.toml` traz `project_id = "pwxvvimdtmvziynbspgx"` (produção atual).
> Para um projeto novo, troque esse valor ou use sempre `--project-ref`.

### 4.3 Extensões

No **SQL Editor**:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

`pg_cron` roda as automações; `pg_net` permite que o banco chame Edge Functions.
Sem eles as migrations de automação falham.

### 4.4 Aplicar as migrations

O repositório tem **312 migrations versionadas** em `supabase/migrations/`.

```bash
supabase db push                     # caminho recomendado
```

Alternativa sem CLI: colar `docs/APLICAR_NO_SUPABASE.sql` no SQL Editor
(consolidado; não substitui o histórico completo de migrations).

Conferência:

```sql
select count(*) from supabase_migrations.schema_migrations;   -- deve bater com 312
select count(*) from pg_tables where schemaname = 'public';
```

### 4.5 Configurar os GUCs do banco (obrigatório)

Os jobs de cron e os triggers chamam Edge Functions através de
`public.invoke_edge_function()`, que lê três parâmetros do banco:

```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://SEU_PROJETO.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = '<service-role JWT>';
ALTER DATABASE postgres SET app.settings.internal_function_secret = '<segredo forte aleatório>';
```

O valor de `internal_function_secret` **precisa ser idêntico** ao secret
`INTERNAL_FUNCTION_SECRET` das Edge Functions ([Etapa 3](#5-etapa-3--edge-functions-e-secrets)).
Sem ele, `process-refund`, `ai-ticket-triage`, `auto-clinical-summary`,
`suggest-reschedule`, `whatsapp-notify` e as demais funções internas respondem 401.

> Gere o segredo com `openssl rand -base64 48`.

### 4.6 ⚠️ Corrigir a URL fixa em `invoke_edge_function` (ambiente novo)

A última definição da função (`supabase/migrations/20260701050200_security_cron_service_role_auth.sql`)
**tem a URL do projeto de produção escrita no código**:

```sql
base_url text := 'https://pwxvvimdtmvziynbspgx.supabase.co/functions/v1/';
```

Num projeto novo (sandbox, staging, self-host) isso faz os crons do **seu** banco
chamarem as funções da **produção alheia**. Depois do `db push`, redefina a função
lendo o GUC:

```sql
CREATE OR REPLACE FUNCTION public.invoke_edge_function(fn_name text, payload jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  request_id bigint;
  base_url text := current_setting('app.settings.supabase_url', true);
  service_key text := current_setting('app.settings.service_role_key', true);
  internal_secret text := current_setting('app.settings.internal_function_secret', true);
  auth_header text := '';
BEGIN
  IF base_url IS NULL OR base_url = '' THEN
    RAISE WARNING 'app.settings.supabase_url não configurado; ignorando %', fn_name;
    RETURN NULL;
  END IF;
  base_url := rtrim(base_url, '/') || '/functions/v1/';
  IF service_key IS NOT NULL AND service_key <> '' THEN
    auth_header := 'Bearer ' || service_key;
  END IF;
  SELECT net.http_post(
    url := base_url || fn_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', auth_header,
      'x-internal-secret', COALESCE(internal_secret, '')
    ),
    body := payload,
    timeout_milliseconds := 30000
  ) INTO request_id;
  RETURN request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'invoke_edge_function(%) falhou: %', fn_name, SQLERRM;
  RETURN NULL;
END $$;
```

Confirme antes de seguir:

```sql
select pg_get_functiondef('public.invoke_edge_function'::regproc) like '%pwxvvimdtmvziynbspgx%' as ainda_hardcoded;
-- precisa retornar false
```

### 4.7 Storage — buckets

As migrations criam parte dos buckets. Confira em **Storage** e crie o que faltar,
respeitando a visibilidade:

| Bucket | Público? | Conteúdo |
|---|---|---|
| `avatars` | público | foto de perfil |
| `site-media` | público | imagens do site/CMS |
| `clinic-logos` | público | logotipos de clínica/contrato |
| `email-assets` | público | imagens dos e-mails |
| `prescriptions` | **privado** | receitas em PDF |
| `certificates` | **privado** | atestados |
| `receitas-assinadas` | **privado** | receitas assinadas |
| `laudos-assinados` | **privado** | laudos assinados |
| `patient-documents` | **privado** | documentos do paciente |
| `doctor-documents` | **privado** | diploma, CRM, documentos do médico |
| `exam-files` / `exames` / `exams` | **privado** | exames enviados |
| `dicom-bucket` | **privado** | imagens DICOM |
| `chat-attachments` | **privado** | anexos do chat |
| `consultation-recordings` / `recordings` | **privado** | gravações |
| `contrato-docs` | **privado** | documentos de contrato B2B/B2G |
| `reports` | **privado** | relatórios |
| `backups` | **privado** | export diário (`daily-backup`) |

```sql
select id, public from storage.buckets order by id;
```

> Nenhum bucket de dado clínico pode aparecer com `public = true`.

### 4.8 Auth

Em **Authentication → Providers / URL Configuration / Rate limits**:

| Item | Valor |
|---|---|
| Email + senha | habilitado (único provider usado) |
| Confirm email | **on** |
| Site URL | `https://aloclinica.com.br` (nunca `localhost` em produção) |
| Redirect URLs | `https://aloclinica.com.br/**`, `https://www.aloclinica.com.br/**`, `https://sandbox.aloclinica.com.br/**`, `http://localhost:8080/**` |
| `rate_limit_email_sent` | **≥ 100/h** (o default 2/h trava o cadastro) |
| JWT expiry | 3600 s |

O trigger `handle_new_user()` cria `profiles` + `user_roles` no cadastro; o papel
inicial vem de `metadata.role`, restrito por whitelist
(`20260724190000_signup_role_whitelist.sql`) — ninguém se autopromove a admin.

```sql
select pg_get_functiondef('public.handle_new_user'::regproc);
```

O envio dos e-mails de autenticação é feito pelo **Send Email Hook**, na
[Etapa 5](#7-etapa-5--e-mail-brevo).

### 4.9 Conferência do banco

```bash
# Scripts prontos no repositório (rode no SQL Editor)
scripts/prod_readiness.sql
scripts/schema_check.sql
scripts/health.sql
```

E rode o **Security Advisor** do Supabase: nenhuma tabela de identidade, consulta,
prescrição, pagamento, KYC ou LGPD pode ficar sem RLS.
---

## 5. Etapa 3 — Edge Functions e secrets

### 5.1 O modelo de autorização (leia antes de mexer)

`supabase/config.toml` documenta a regra: `verify_jwt = true` (default) **não é
autorização real** — a chave anon é pública e satisfaz o gateway. A autorização de
verdade acontece **dentro de cada função**, via `functions/_shared/auth.ts`
(`getCaller`, `isInternalOrService`, `safeEqual`).

Só 18 funções ficam com `verify_jwt = false`, porque quem chama é um sistema externo
sem JWT do Supabase — e cada uma autentica sozinha:

| Grupo | Funções | Como autenticam |
|---|---|---|
| Webhooks de gateway | `mercadopago-webhook`, `pagbank-webhook`, `docuseal-webhook` | assinatura HMAC / token de autenticidade / segredo compartilhado |
| OAuth | `mp-oauth-callback` | `state` gerado no servidor (anti-CSRF) |
| Público | `public-api`, `robots-txt`, `doctor-ical-feed`, `log-failed-login` | API key com hash, conteúdo estático, token imprevisível na URL, rate limit por IP |
| Cron/trigger internos | `daily-backup`, `scheduled-tasks`, `appointment-confirmed`, `emit-nfse`, `auth-email-hook`, `appointment-reminders`, `lembrete-consultas`, `post-consultation-survey`, `patient-nudges`, `no-show-reminder-tick` | `isInternalOrService()` — bearer service-role **ou** `x-internal-secret` |

**Nunca** faça deploy com `--no-verify-jwt` global: isso desliga o gateway para todas
as funções de uma vez.

### 5.2 Definir os secrets

Pelo painel (**Edge Functions → Secrets**) ou pelo CLI:

```bash
supabase secrets set \
  INTERNAL_FUNCTION_SECRET='<mesmo valor do GUC do banco>' \
  SITE_URL='https://aloclinica.com.br' \
  SITE_DOMAIN='aloclinica.com.br' \
  APP_URL='https://aloclinica.com.br' \
  APP_BASE_URL='https://aloclinica.com.br' \
  APP_ENV='production' \
  --project-ref <SEU_REF>

supabase secrets list --project-ref <SEU_REF>     # mostra nomes, nunca valores
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetados
automaticamente pela plataforma — **não** os defina à mão.

### 5.3 Secrets do núcleo (defina agora)

| Secret | Consumido por | Se faltar |
|---|---|---|
| `INTERNAL_FUNCTION_SECRET` | 18 funções internas (`process-refund`, `ai-ticket-triage`, `auto-clinical-summary`, `suggest-reschedule`, `cart-abandonment`, `whatsapp-notify`, `pagbank-webhook`, `emit-nfse`, `post-consultation-survey`, `lembrete-consultas`, `appointment-confirmed`…) | automações respondem 401 e param silenciosamente |
| `SITE_URL` / `SITE_DOMAIN` | `send-email` | links dos e-mails saem errados |
| `APP_URL` | `mercadopago-create-subscription` | retorno da assinatura quebra |
| `APP_BASE_URL` | `appointment-confirmed`, `appointment-reminders`, `whatsapp-notify` | links dos lembretes quebram |
| `APP_ENV`, `APP_RELEASE`, `GIT_COMMIT_SHA`, `ENVIRONMENT` | `service-health` | painel de saúde sem versão (o workflow de deploy já publica `APP_ENV`/`APP_RELEASE`) |
| `DOCTOR_PROFESSIONAL_ADDRESS` | `generate-prescription-pdf`, `generate-certificate-pdf` | endereço profissional some do PDF (exigência CFM) |
| `PLATFORM_FEE_PERCENT` | `mercadopago-create-payment` | assume 10% |
| `AUTO_PAYOUT_TICK_SECRET` | `auto-payout-tick`, `no-show-reminder-tick` | tick responde 401 (fail-closed) |
| `ALLOW_TEST_SEED=false` | `seed-test-users`, `seed-test-doctors` | **mantenha `false` em produção** |

### 5.4 Deploy das funções

O repositório tem **90 funções implantáveis** (diretórios com `index.ts`, fora `_shared`).

```bash
# Todas de uma vez (primeira instalação)
supabase functions deploy --project-ref <SEU_REF>

# Uma específica
supabase functions deploy mercadopago-webhook --project-ref <SEU_REF> --use-api
```

Em produção o `deploy.yml` publica **apenas as funções alteradas no commit** e
**exclui explicitamente** `seed-test-users` e `seed-test-doctors` — mantenha essa
exclusão, ela é um controle de segurança auditado (SEC-001).

Conferência de paridade local × remoto:

```bash
ls -d supabase/functions/*/ | xargs -n1 basename | grep -v '^_shared$' | sort > /tmp/local.txt
supabase functions list --project-ref <SEU_REF>
# compare as listas; qualquer diferença é drift e precisa de justificativa
```

### 5.5 Automações (pg_cron)

Depois do `db push` os jobs já existem. Confira:

```sql
select jobid, jobname, schedule, active from cron.job order by jobname;
select jobname, status, start_time, return_message
from cron.job_run_details order by start_time desc limit 20;
```

Jobs versionados no repositório:

| Job | Cron | Faz |
|---|---|---|
| `daily-backup` | `0 3 * * *` | export diário com SHA-256 e manifest |
| `appointment-reminders` | `*/5 * * * *` | lembrete de consulta |
| `pix-expiry-reminder` | `*/5 * * * *` | aviso de PIX vencendo |
| `nps-whatsapp-followup` | `*/10 * * * *` | pesquisa pós-consulta |
| `release-doctor-payouts` | `0 */2 * * *` | libera repasse ao médico |
| `subscription-retry` | `0 */6 * * *` | reprocessa assinatura |
| `auto-pause-doctors` | `0 * * * *` | pausa médico inativo |
| `anonymize-old-patients` | `0 3 * * 0` | anonimização LGPD |
| `doctor-risk-score` | `0 3 * * *` | score de risco |
| `detect-churn` | `0 9 * * *` | churn |
| `prescription-renewal-alert` | `0 9 * * *` | receita vencendo |
| `reengagement-inactive` | `0 10 * * *` | reengajamento |
| `suggest-price-increase` | `0 11 * * 1` | sugestão de preço |
| `idle-slot-suggestion` | `0 9 * * 1` | agenda ociosa |
| `weekly-admin-report` | `0 9 * * 1` | relatório semanal |
| `nfse-reprocess` | a cada 15 min | reprocessa nota fiscal |

---

## 6. Etapa 4 — Conta admin (bootstrap)

A função `create-admin-account` cria o primeiro administrador e **recusa** rodar sem
os três segredos abaixo (fail-closed proposital).

```bash
supabase secrets set \
  ADMIN_BOOTSTRAP_SECRET="$(openssl rand -base64 48)" \
  ADMIN_BOOTSTRAP_EMAIL='admin@aloclinica.com.br' \
  ADMIN_BOOTSTRAP_PASSWORD='<senha forte>' \
  --project-ref <SEU_REF>

curl -X POST "https://<SEU_REF>.supabase.co/functions/v1/create-admin-account" \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-secret: <ADMIN_BOOTSTRAP_SECRET>"
```

Depois:

1. Entre na plataforma com esse e-mail e **troque a senha**.
2. **Apague `ADMIN_BOOTSTRAP_PASSWORD`** dos secrets.
3. Papéis adicionais (médico, clínica, suporte) só pela função `assign-role`, já
   protegida pela migration `20260820231000_secure_admin_role_management.sql`.

```sql
select ur.role, p.email from public.user_roles ur
join public.profiles p on p.id = ur.user_id
where ur.role = 'admin';
```

---

## 7. Etapa 5 — E-mail (Brevo)

**Provedor real do sistema: Brevo.** As funções `send-email` (40+ templates) e
`auth-email-hook` (e-mails de autenticação) usam a API do Brevo.
`RESEND_API_KEY` aparece só em dois fluxos legados (`guest-checkout`,
`b2b-lead-notification`) — não é o canal principal.

### 7.1 Conta e chave

1. https://app.brevo.com → **SMTP & API → API Keys → Generate**.
2. Guarde a chave (`xkeysib-...`).

### 7.2 Autenticar o domínio (SPF/DKIM/DMARC)

1. **Settings → Senders, Domains & Dedicated IPs → Domains → Add domain**.
2. Use o mesmo domínio de `EMAIL_FROM_ADDRESS`.
3. Publique no DNS os registros SPF, DKIM e DMARC exibidos.
4. Clique em **Authenticate** até ficar verde.

Sem isso os e-mails caem em spam — o cadastro trava na prática.

### 7.3 Secrets

```bash
supabase secrets set \
  BREVO_API_KEY='xkeysib-...' \
  EMAIL_FROM_ADDRESS='noreply@aloclinica.com.br' \
  EMAIL_FROM_NAME='AloClínica' \
  EMAIL_SUPPORT_ADDRESS='suporte@aloclinica.com.br' \
  EMAIL_COMPANY_ADDRESS='ALO CLINICA MEDICA LTDA — Boa Vista/RR' \
  --project-ref <SEU_REF>
```

### 7.4 Send Email Hook (e-mails de autenticação)

Sem este hook, confirmação de cadastro e reset de senha dependem do SMTP interno —
que já falhou com erro 500 em produção.

1. Deploy da função: `supabase functions deploy auth-email-hook`.
2. Supabase → **Authentication → Hooks → Send Email Hook**:
   - **Enable**: on
   - **URI**: `https://<SEU_REF>.supabase.co/functions/v1/auth-email-hook`
   - Copie o **secret** gerado (formato `v1,whsec_...`).
3. Grave o secret:
   ```bash
   supabase secrets set SEND_EMAIL_HOOK_SECRET='v1,whsec_...' --project-ref <SEU_REF>
   ```
   A função valida a assinatura Standard Webhooks e **rejeita tudo** se o segredo
   estiver ausente.

### 7.5 Validar

Crie um paciente de teste e confirme que o e-mail chega **na caixa de entrada**.

```sql
select email, confirmation_sent_at, confirmed_at
from auth.users order by created_at desc limit 5;
```

---

## 8. Etapa 6 — Pagamentos (Mercado Pago / PagBank)

### 8.1 Aplicação no Mercado Pago

1. https://www.mercadopago.com.br/developers/panel → conta **PJ da plataforma**.
2. **Suas integrações → Criar aplicação**:
   - Nome: `AloClinica Marketplace`
   - Modelo: **Marketplace / Plataforma**
   - Produto: Pagamentos online
   - "Integra em nome de terceiros": **sim**
3. Em **Configurações da aplicação**:

| Campo | Valor |
|---|---|
| Redirect URI | `https://<SEU_REF>.supabase.co/functions/v1/mp-oauth-callback` |
| Notification URL | `https://<SEU_REF>.supabase.co/functions/v1/mercadopago-webhook` |
| Eventos | `payment`, `merchant_order`, `subscription_preapproval`, `subscription_authorized_payment` |

4. Em **Credenciais de produção**, colete: `APP_ID` (client_id), `Client Secret`,
   `Access Token` e a `Public Key`.
5. Em **Webhooks**, copie a **assinatura secreta** (usada no header `x-signature`).

### 8.2 Secrets e variável pública

```bash
supabase secrets set \
  MERCADOPAGO_ACCESS_TOKEN='APP_USR-...' \
  MERCADOPAGO_WEBHOOK_SECRET='<segredo do painel MP>' \
  MERCADOPAGO_APP_ID='<app id>' \
  MERCADOPAGO_CLIENT_SECRET='<client secret>' \
  PLATFORM_FEE_PERCENT='10' \
  --project-ref <SEU_REF>
```

A **public key** (`VITE_MERCADOPAGO_PUBLIC_KEY`) vai no build do frontend — ela é
pública por design.

> `mercadopago-webhook` valida HMAC e é **fail-closed**: sem
> `MERCADOPAGO_WEBHOOK_SECRET`, todo webhook é recusado e nenhum pagamento é
> confirmado. Este é o erro nº 1 de instalação.

### 8.3 Split 90/10 (marketplace)

Cada médico conecta a própria conta MP pelo fluxo OAuth (`mp-oauth-init` →
`mp-oauth-callback`). Com a conta conectada, o pagamento vai direto para o médico e a
plataforma retém `marketplace_fee` (10% por padrão, ajustável em `PLATFORM_FEE_PERCENT`).
Sem conta conectada, o valor cai na conta da plataforma e o repasse é feito pelo
job `release-doctor-payouts` + `withdrawal_requests`.

### 8.4 PagBank (opcional)

```bash
supabase secrets set \
  PAGBANK_TOKEN='...' PAGBANK_ENV='production' PAGBANK_ACCOUNT_ID='...' \
  --project-ref <SEU_REF>
```

Webhook: `https://<SEU_REF>.supabase.co/functions/v1/pagbank-webhook`
(autenticado por `x-authenticity-token`, SHA-256).

### 8.5 Testar de verdade

1. Admin → `/dashboard/admin/payment-test` → PIX de **R$ 1**.
2. Pague no app do banco.
3. Confirme:
   ```sql
   select id, gateway, status, amount, created_at
   from payment_transactions order by created_at desc limit 5;
   ```
4. Teste o estorno (`mercadopago-refund`) e confira a conciliação.
5. Se o webhook não chegar: veja os logs em Supabase → Functions → `mercadopago-webhook`.

---

## 9. Etapa 7 — Vídeo (MiroTalk + coturn)

Duas peças: **MiroTalk** (a sala) e **coturn** (o relay TURN/STUN que faz a chamada
atravessar NAT e firewall corporativo).

### 9.1 MiroTalk

No EasyPanel/Docker do VPS, suba o **MiroTalk P2P** e publique em
`meet.seudominio` com TLS. Variáveis relevantes do container:

```env
JWT_KEY=<segredo forte>
API_KEY_SECRET=<segredo forte>
HOST_PROTECTED=true
HOST_USER_AUTH=true
JWT_EXP=1h
```

Secrets correspondentes no Supabase:

```bash
supabase secrets set \
  MIROTALK_URL='https://meet.seudominio' \
  MIROTALK_API_KEY='<mesmo API_KEY_SECRET>' \
  --project-ref <SEU_REF>
```

A função `mirotalk-token` só emite token para quem é paciente ou médico **daquela**
consulta, dentro da janela de acesso, e o nome da sala é um segredo por consulta
(`appointments.video_room_secret`). Detalhes e ordem de ativação em
[`security/REMEDIATION-mirotalk-jwt.md`](security/REMEDIATION-mirotalk-jwt.md).

> Ligue a proteção JWT **depois** de validar que a entrada com token funciona —
> senão o vídeo trava para todo mundo.

### 9.2 coturn (TURN/STUN próprio)

O repositório **não versiona** o compose do coturn; o serviço existe no VPS. Referência
de instalação equivalente:

```bash
docker run -d --name coturn --restart unless-stopped --network host \
  instrumentisto/coturn \
  -n --log-file=stdout \
  --listening-port=3478 \
  --fingerprint --lt-cred-mech \
  --user=mirotalk:<SENHA_FORTE> \
  --realm=seudominio \
  --external-ip=<IP_PUBLICO_DO_VPS> \
  --no-tls --no-dtls
```

Libere no firewall: **3478/udp**, **3478/tcp** e a faixa de mídia
(**49152–65535/udp**).

```bash
supabase secrets set \
  COTURN_HOST='<IP ou host do coturn>' \
  COTURN_PORT='3478' \
  COTURN_USER='mirotalk' \
  COTURN_PASS='<mesma senha do --user>' \
  --project-ref <SEU_REF>
```

`turn-credentials` entrega três camadas: coturn próprio → Metered (se configurado) →
STUN público do Google. **Sem `COTURN_PASS` a camada TURN some** e resta só STUN, que
não funciona atrás de NAT simétrico.

### 9.3 Metered (TURN gerenciado, opcional)

```bash
supabase secrets set METERED_APP_NAME='...' METERED_SECRET_KEY='...' --project-ref <SEU_REF>
```

### 9.4 Validar

```bash
curl -I https://meet.seudominio          # MiroTalk responde
nc -zv <IP_DO_VPS> 3478                  # coturn TCP aberto
```

- Teste em **duas redes diferentes** (ex.: fibra × 4G).
- Confirme em https://icetest.info/ que o candidato `relay` aparece.
- Faça uma consulta real de teste entre dois dispositivos.

---

## 10. Etapa 8 — KYC facial (CompreFace + anti-spoof)

Verificação de identidade é **exigência do CFM 2.314/2022** para teleconsulta. O
`KycRequiredGate` bloqueia agendamento e consulta enquanto o KYC não passar.

### 10.1 Subir o CompreFace

O compose já vem afinado para VPS com pouca memória em
[`compreface/docker-compose.yml`](../compreface/docker-compose.yml) — 5 containers,
~3,9 GB de limite somado (o `compreface-core` sozinho precisa de 2 GB para carregar
ArcFace + RetinaFace).

```bash
cd compreface
# troque a senha 'cf_Al0clinica_2026_dbpw' do Postgres antes de subir em produção
docker compose up -d
docker compose ps
```

No EasyPanel: crie o app pelo template Compose, cole o arquivo e publique o serviço
`compreface-fe` (porta 80) no domínio `face.seudominio` com Let's Encrypt.

### 10.2 DNS

Cloudflare → DNS → **Add record**: `A` · nome `face` · IP do VPS · proxy igual ao do
apex. Propaga em 1–5 min.

### 10.3 Criar as chaves dentro do CompreFace

1. Abra `https://face.seudominio` e crie a conta de administrador.
2. Crie uma **Application**.
3. Dentro dela crie dois serviços: **Face Detection** e **Face Verification**.
4. Copie a API key de cada um.

```bash
supabase secrets set \
  COMPREFACE_URL='https://face.seudominio' \
  COMPREFACE_DETECT_KEY='<key do Detection>' \
  COMPREFACE_VERIFY_KEY='<key do Verification>' \
  COMPREFACE_API_KEY='<key da Application>' \
  --project-ref <SEU_REF>
```

`didit-kyc` usa DETECT + VERIFY; `compreface-proxy` usa as três.

### 10.4 Anti-spoof (recomendado)

Impede que uma foto na tela passe como rosto vivo.

```bash
cd antispoof-service
docker build -t aloclinica-antispoof .
docker run -d --name antispoof --restart unless-stopped \
  -e ANTISPOOF_API_KEY='<segredo forte>' \
  -p 127.0.0.1:8000:8000 aloclinica-antispoof
```

```bash
supabase secrets set \
  ANTISPOOF_URL='https://antispoof.seudominio' \
  ANTISPOOF_API_KEY='<mesmo segredo>' \
  ANTISPOOF_REQUIRED='false' \
  --project-ref <SEU_REF>
```

> O modelo leva ~180 s para carregar na primeira execução. Comece com
> `ANTISPOOF_REQUIRED=false` (fail-open); só mude para `true` depois de observar a
> taxa de falso-negativo em produção.

### 10.5 Anthropic (leitura do documento)

`didit-kyc` usa Claude Vision para ler o documento oficial:

```bash
supabase secrets set ANTHROPIC_API_KEY='sk-ant-...' --project-ref <SEU_REF>
```

### 10.6 Validar

- `https://face.seudominio` abre o painel do CompreFace.
- **Admin → Saúde do Sistema** mostra o KYC **verde**.
- Um cadastro de teste conclui a verificação:
  ```sql
  select count(*) from kyc_verificacoes where created_at > now() - interval '24 hours';
  ```

> `src/config/service-status.ts` já está com `SERVICES_PENDING_SETUP` **vazio** —
> ou seja, o monitor trata o KYC como crítico. Se o CompreFace não subir, o painel
> acusa falha (e não "pendente"). É o comportamento correto para produção.
---

## 11. Etapa 9 — WhatsApp (Evolution API)

Usado para lembrete de consulta, aviso de PIX, NPS e envio de receita.

### 11.1 Subir o gateway

No EasyPanel/Docker, suba a **Evolution API** e publique em `whatsapp.seudominio`
com TLS. Defina uma `AUTHENTICATION_API_KEY` forte no container.

> A função `send-whatsapp` **exige HTTPS** — ela recusa `http://` explicitamente
> (sem downgrade de texto puro).

### 11.2 Secrets

```bash
supabase secrets set \
  EVOLUTION_API_URL='https://whatsapp.seudominio' \
  EVOLUTION_API_KEY='<mesma AUTHENTICATION_API_KEY>' \
  --project-ref <SEU_REF>
```

### 11.3 Parear o número

1. Entre como **admin** → painel de **WhatsApp**.
2. Gere o QR (`whatsapp-qr`) e escaneie com o WhatsApp oficial da clínica.
3. Confirme o status **conectado**.

Sem o pareamento, os avisos ficam em modo dev — não saem, mas nada quebra.

### 11.4 Consentimento (LGPD)

A migration `20260724160000_whatsapp_consent_lgpd.sql` exige consentimento antes do
envio. Não desabilite: mensagem sem opt-in é infração de LGPD.

---

## 12. Etapa 10 — Push notifications (VAPID)

```bash
npx web-push generate-vapid-keys
```

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY='<pública>' \
  VAPID_PRIVATE_KEY='<privada>' \
  VAPID_SUBJECT='mailto:suporte@aloclinica.com.br' \
  --project-ref <SEU_REF>
```

A **pública** também vai para o build do frontend como `VITE_VAPID_PUBLIC_KEY`.
`send-push-notification` exige as três variáveis — faltando uma, o push fica dormente.

---

## 13. Etapa 11 — Prescrição e assinatura digital

Três caminhos, complementares:

### 13.1 Memed — receita com assinatura ICP-Brasil

1. Contrate a Memed (https://memed.com.br) e peça as credenciais de integração.
2. ```bash
   supabase secrets set MEMED_API_KEY='...' MEMED_SECRET_KEY='...' --project-ref <SEU_REF>
   ```
3. No frontend, `VITE_MEMED_ENABLED=true` liga a interface.

As credenciais ficam **só no servidor** (`memed-prescriber`) — nunca no bundle.

### 13.2 VIDAAS — assinatura ICP-Brasil em nuvem

```bash
supabase secrets set VIDAAS_CLIENT_ID='...' VIDAAS_CLIENT_SECRET='...' --project-ref <SEU_REF>
```

Funções: `vidaas-sign` e `vidaas-callback`. No frontend, `VITE_ICP_ENABLED=true`.

### 13.3 DocuSeal — contratos e termos

```bash
supabase secrets set \
  DOCUSEAL_BASE='https://docuseal.seudominio' \
  DOCUSEAL_API_KEY='...' \
  DOCUSEAL_WEBHOOK_SECRET='<segredo compartilhado>' \
  --project-ref <SEU_REF>
```

Webhook no DocuSeal: `https://<SEU_REF>.supabase.co/functions/v1/docuseal-webhook`,
com o header `x-docuseal-secret`. A função valida em tempo constante e é
**fail-closed**.

> **Honestidade jurídica:** sem provedor ICP-Brasil configurado, o documento gerado é
> um PDF com registro interno — não uma assinatura qualificada. O código não finge o
> contrário e o `register-signature` grava o que de fato aconteceu.

---

## 14. Etapa 12 — Nota fiscal (NFS-e / Focus NFe)

Emissão automática por consulta e por plantão. Fica **dormente (fail-open)** até a
configuração fiscal terminar — não emite e não quebra o pagamento.

### 14.1 Pré-requisitos com o contador

1. Inscrição municipal da empresa habilitada a emitir NFS-e.
2. Conta na **Focus NFe** (focusnfe.com.br) com a empresa cadastrada e o
   **certificado digital A1 (.pfx)** enviado no painel.
3. **Boa Vista/RR usa a NFS-e NACIONAL** (endpoint `/v2/nfsen`, DPS). No painel da
   Focus o contador precisa habilitar `habilita_nfsen_homologacao` e
   `habilita_nfsen_producao`, com `habilita_nfse = false`. Isso **só é feito pelo
   painel da Focus** — token nenhum altera essa configuração.
4. O contador informa o **código de tributação nacional** da teleconsulta (substitui o
   antigo "item 4.05").

### 14.2 Secrets

```bash
supabase secrets set \
  FOCUS_NFE_TOKEN='...' \
  FOCUS_NFE_AMBIENTE='homologacao' \
  NFSE_PADRAO='nacional' \
  NFSE_CNPJ='66474468000126' \
  NFSE_INSCRICAO_MUNICIPAL='...' \
  NFSE_CITY_IBGE='1400100' \
  NFSE_CODIGO_TRIBUTACAO_NACIONAL='<informado pelo contador>' \
  NFSE_SERVICE_DESC='Teleconsulta médica' \
  --project-ref <SEU_REF>
```

Só para o padrão **municipal** (não usado em Boa Vista): `NFSE_ITEM_LISTA_SERVICO`,
`NFSE_CODIGO_TRIBUTARIO_MUNICIPIO`, `NFSE_ISS_RATE`.

### 14.3 Validar e ligar

1. Com `FOCUS_NFE_AMBIENTE=homologacao`, pague uma consulta de teste.
2. Confira em **Admin → Operação → Notas Fiscais**.
3. Passe para `producao` e emita uma nota real de baixo valor.

O job `nfse-reprocess` tenta de novo a cada 15 min o que a prefeitura demorar a aceitar.

---

## 15. Etapa 13 — IA clínica (Anthropic)

```bash
supabase secrets set ANTHROPIC_API_KEY='sk-ant-...' --project-ref <SEU_REF>
```

Usada por `pingo-chat` (assistente), `clinical-ai`, `auto-clinical-summary`,
`symptom-triage` e pela leitura de documento do `didit-kyc`.

`LOVABLE_API_KEY` (`ai-symptom-triage`, `faq-chat-bot`, fallback do `pingo-chat`) é
herança do ambiente Lovable — opcional.

> Configure **limite de gasto** no console da Anthropic antes de abrir ao público.

---

## 16. Etapa 14 — Validação de CRM

Automatiza a checagem do registro do médico no conselho. Sem isso, a aprovação é
manual pelo admin — o que é aceitável no começo.

```bash
supabase secrets set \
  INFOSIMPLES_TOKEN='...' \
  CONSULTA_CRM_API_KEY='...' \
  --project-ref <SEU_REF>
```

Funções: `verify-council` / `validate-council` (InfoSimples) e `verify-crm`
(ConsultaCRM). A migration `20260803110000_c1_protect_doctor_verification.sql`
impede que um médico marque o próprio `crm_verified` como `true`:

```sql
select tgname from pg_trigger where tgrelid = 'public.doctor_profiles'::regclass;
-- deve conter zzz_protect_doctor_verification
```

---

## 17. Etapa 15 — Observabilidade (Sentry)

1. https://sentry.io → novo projeto **React**.
2. Copie o **DSN**.
3. Coloque em `VITE_SENTRY_DSN` no `.env`, nos GitHub Secrets e nas variáveis do
   Cloudflare Pages.
4. Faça o build e dispare um erro de teste; confirme que ele aparece no Sentry.

Complementos já existentes: `activity_logs` (auditoria, com arquivamento >90 dias),
logs das Edge Functions no dashboard do Supabase, e o painel **Admin → Saúde do
Sistema** alimentado por `service-health`.

---

## 18. Etapa 16 — Frontend em produção (Cloudflare Pages / VPS)

### 18.1 Caminho recomendado — Cloudflare Pages

1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**.
2. Repositório e branch `main`.
3. **Build settings:**
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
   - Variável `NODE_VERSION` = `20`
4. **Environment variables** (só `VITE_*`, só chaves públicas):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MERCADOPAGO_PUBLIC_KEY`,
   `VITE_SENTRY_DSN`, `VITE_APP_ENV=production`, `VITE_COMPREFACE_URL`,
   `VITE_MIROTALK_URL`, `VITE_VAPID_PUBLIC_KEY`, e opcionalmente
   `VITE_GA_MEASUREMENT_ID` / `VITE_META_PIXEL_ID`.
5. **Save and Deploy** → teste no link `*.pages.dev` **antes** de virar o domínio:
   home carrega, login funciona (banco conectando = CSP ok), `/agendar` navega,
   console sem erro vermelho.
6. **Custom domains** → `aloclinica.com.br` e `www`. TLS é automático.

`public/_redirects` já garante o fallback de SPA e `public/_headers` traz CSP, HSTS e
`noindex` nas áreas autenticadas.

### 18.2 ⚠️ Revisar a CSP antes de publicar

`public/_headers` e `nginx.conf` hoje liberam:

- `http://72.62.138.208:8000|8042|3001|3200` — **mixed content** em página HTTPS;
- em `_headers`, um **segundo projeto Supabase** (`hikttmmwxcjmzexxhgda`), além do de produção.

Ao instalar num domínio novo: troque esses endereços pelos **seus** subdomínios HTTPS
e remova o que não usar. A CSP precisa listar exatamente: seu Supabase (`https` e
`wss`), seu MiroTalk (`https`, `wss`, `frame-src`), Mercado Pago/PagBank, Brevo,
Anthropic, Sentry e Metered.

### 18.3 Caminho alternativo — Docker/nginx no VPS

```bash
docker build -t aloclinica-web .
docker run -d --name aloclinica-web --restart unless-stopped \
  -p 127.0.0.1:8080:80 aloclinica-web
```

`docker-compose.yml` usa `Dockerfile.ci`, entra na rede externa `easypanel`, limita a
256 MB e expõe `/health`. O TLS/roteamento fica com o Traefik do EasyPanel — por isso
o `Dockerfile` **não** define `HEALTHCHECK` (com Swarm, isso segura o container como
"unhealthy" e o proxy devolve 502).

Preparo do servidor: [`scripts/vps-setup.sh`](../scripts/vps-setup.sh) (chave SSH,
login só por chave, updates, Docker, firewall).

---

## 19. Etapa 17 — DNS, TLS e subdomínios de tenant

### 19.1 Registros básicos

| Nome | Tipo | Aponta para | Serve |
|---|---|---|---|
| `@` / `www` | conforme host | Cloudflare Pages ou IP do VPS | site |
| `face` | A | IP do VPS | CompreFace (KYC) |
| `meet` | A | IP do VPS | MiroTalk |
| `whatsapp` | A | IP do VPS | Evolution API |
| `sandbox` | conforme host | projeto Pages de sandbox | homologação |
| `*` | A | IP do VPS | subdomínios de contrato |

### 19.2 Subdomínio por contrato (B2B/B2G)

Para `prefeitura-x.aloclinica.com.br` funcionar com branding próprio:

1. Migration `20260527000000_contratos_glue.sql` aplicada (cria `resolve_tenant`,
   `dominio_proprio`, elegibilidade e consumo).
2. Deploy da função `contrato-checkout`.
3. DNS wildcard: `*.aloclinica.com.br  A  <IP>`.
4. Traefik: use [`deploy/traefik/aloclinica-subdomains.yml`](../deploy/traefik/aloclinica-subdomains.yml)
   como **file config dinâmico** (não labels). O certificado wildcard exige
   **DNS-01** — HTTP-01 não emite wildcard:
   ```yaml
   certificatesResolvers:
     letsencrypt:
       acme:
         email: admin@aloclinica.com.br
         storage: /letsencrypt/acme.json
         dnsChallenge:
           provider: cloudflare
   ```
   com `CF_DNS_API_TOKEN` no container do Traefik.
5. Crie o contrato em **Admin → Contratos & Ações** (subdomínio, branding, beneficiários).

Teste rápido sem DNS: `https://aloclinica.com.br/p/prefeitura-x` — o `ContratoContext`
também resolve por path.

Verificação:

```bash
curl -s "https://<SEU_REF>.supabase.co/rest/v1/rpc/resolve_tenant" \
  -H "apikey: <ANON>" -H "Content-Type: application/json" \
  -d '{"p_host":"prefeitura-x.aloclinica.com.br","p_slug":null}'
```

---

## 20. Etapa 18 — CI/CD (GitHub Actions)

### 20.1 Secrets do repositório

**Settings → Secrets and variables → Actions**:

| Secret | Para quê |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | deploy das Edge Functions (`sbp_...`) |
| `CLOUDFLARE_API_TOKEN` | deploy no Pages |
| `VITE_SUPABASE_URL` | build |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | build |
| `VITE_SENTRY_DSN` | build |
| `VPS_SSH_PRIVATE_KEY` | só se usar o caminho VPS |

Ajuste também `SUPABASE_PROJECT_REF` e `CLOUDFLARE_ACCOUNT_ID` no `env:` do
`deploy.yml` para os **seus** identificadores.

### 20.2 Workflows disponíveis (10)

| Workflow | Dispara | Faz |
|---|---|---|
| `test.yml` | push/PR | tsc + ESLint + Vitest + build + Playwright |
| `deploy.yml` | push em `main` | build → Cloudflare Pages → Edge Functions alteradas → health check |
| `deploy-staging.yml` | manual/branch | ambiente de homologação |
| `production-readiness.yml` | manual | auditoria de prontidão |
| `check-go-live.yml` | manual | gates de go-live |
| `database-safety.yml` | semanal/manual | divergência entre migrations locais e remotas (somente leitura) |
| `apply-migration.yml` | manual | aplica migration controlada |
| `rollback-production.yml` | manual | volta a versão anterior |
| `android-build.yml` | manual | APK/AAB |
| `preserve-design-system.yml` | automático | backup do design system |

### 20.3 Scripts de verificação

```bash
npm run audit:production      # auditoria estática de segurança
npm run audit:integrations    # prontidão das integrações
npm run health:production     # saúde dos endpoints públicos
npm run load:baseline         # baseline de carga HTTP
```

---

## 21. Etapa 19 — Backup e recuperação

1. **PITR do Supabase** (plano Pro) — ligue em Database → Backups. É o backup real.
2. **`daily-backup`** (cron 03:00) — export JSON paginado, com SHA-256 por arquivo e
   manifest publicado por último; falha total se qualquer etapa falhar (não existe
   "sucesso parcial").
3. **Cópia offsite criptografada** — o export fica no mesmo projeto; sozinho **não é
   DR**. Leve para outro provedor.
4. **Ensaie a restauração** num projeto isolado e registre data, RTO e RPO.

Procedimento completo em [`BACKUP_AND_DISASTER_RECOVERY.md`](BACKUP_AND_DISASTER_RECOVERY.md).

Retenção legal: prontuário é **imutável** (DELETE bloqueado por RLS RESTRICTIVE) e
retido por **20 anos** (CFM 1.821/2007).

---

## 22. Etapa 20 — Apps móveis (Capacitor)

```bash
npm install
npm run build
npx cap add android
npx cap add ios          # exige macOS
npx cap sync
```

Ícones e splash a partir de `resources/`:

```bash
npm i -D @capacitor/assets
npx @capacitor/assets generate --iconBackgroundColor '#1a6fc4' --splashBackgroundColor '#1a6fc4'
npx cap sync
```

Permissões obrigatórias (senão a loja reprova ou o recurso quebra): câmera,
microfone, `MODIFY_AUDIO_SETTINGS` e notificações no `AndroidManifest.xml`;
`NSCameraUsageDescription` e `NSMicrophoneUsageDescription` em PT-BR no `Info.plist`.

`appId`: `br.com.aloclinica.app` — precisa estar registrado no Google Play Console e
no Apple Developer. Passo a passo de publicação em
[`MOBILE_RELEASE_GUIDE.md`](MOBILE_RELEASE_GUIDE.md).

---

## 23. Etapa 21 — Ambiente sandbox

Sandbox usa **projeto Supabase próprio** e credenciais de teste. O build **falha de
propósito** se apontar para o Supabase de produção.

```bash
cp .env.sandbox.example .env.sandbox
npm run build:sandbox
npm run deploy:sandbox      # Cloudflare Pages, projeto aloclinica-sandbox, branch sandbox
```

Regras não negociáveis: banner de homologação permanente, `noindex`/`nofollow`,
nenhum dado real copiado, `SEED_SECRET` só no sandbox, webhooks e cobranças reais
desligados, e proteção do domínio com Cloudflare Access.

Repita para o sandbox **todas** as etapas 2–15 com credenciais de teste — inclusive a
correção do [item 4.6](#46--corrigir-a-url-fixa-em-invoke_edge_function-ambiente-novo),
sem a qual os crons do sandbox chamam a produção.

---

## 24. Validação final ponta a ponta

### 24.1 Fluxo clínico completo

| # | Passo | Prova de que passou |
|---|---|---|
| 1 | Cadastrar paciente | e-mail de confirmação na caixa de entrada |
| 2 | Concluir o KYC facial | `kyc_verificacoes` com registro aprovado |
| 3 | Cadastrar médico e aprovar no admin | `doctor_profiles.crm_verified = true` pelo admin |
| 4 | Agendar consulta | linha em `appointments` |
| 5 | Pagar (PIX R$ 1) | `payment_transactions.status = 'approved'` via webhook |
| 6 | Aceitar o TCLE | linha em `patient_consents` |
| 7 | Entrar na videochamada (2 redes) | vídeo e áudio nos dois lados |
| 8 | Registrar prontuário (SOAP) | nota salva e **não apagável** |
| 9 | Emitir receita | PDF gerado e assinado pelo provedor configurado |
| 10 | Validar o QR da receita em `/validate` | validação confirma o documento |
| 11 | Emitir NFS-e | nota em **Admin → Notas Fiscais** |
| 12 | Receber lembrete/NPS | e-mail e/ou WhatsApp entregues |
| 13 | Estornar o pagamento | `mercadopago-refund` conciliado |

### 24.2 Comandos

```bash
npm run audit:production
npm run audit:integrations
npm run health:production -- --json
npm run load:baseline
```

### 24.3 Checklist de segurança antes de abrir ao público

- [ ] Security Advisor do Supabase sem alerta crítico
- [ ] Nenhum bucket clínico público
- [ ] `ALLOW_TEST_SEED=false` e funções de seed **fora** do deploy
- [ ] `ADMIN_BOOTSTRAP_PASSWORD` removido depois do primeiro acesso
- [ ] Credenciais que já circularam em chat/print **rotacionadas**
- [ ] Todos os webhooks com secret configurado (senão ficam fail-closed)
- [ ] CSP sem `http://` e sem projeto Supabase alheio
- [ ] SPF/DKIM/DMARC verdes no Brevo
- [ ] PITR ligado e restauração ensaiada
- [ ] Sentry recebendo eventos
- [ ] `READINESS_MATRIX.md` com todos os gates bloqueantes verdes
---

## Anexo A — Todas as variáveis

### A.1 Frontend (`VITE_*`, públicas, entram no bundle)

| Variável | Obrigatória | Usada em |
|---|---|---|
| `VITE_SUPABASE_URL` | **sim** | cliente Supabase (`src/lib/supabase-config.ts`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **sim** | cliente Supabase |
| `VITE_APP_ENV` | recomendada | `production` / `sandbox` — trava o sandbox |
| `VITE_APP_URL` | recomendada | links absolutos |
| `VITE_MERCADOPAGO_PUBLIC_KEY` | se cobra | SDK do Mercado Pago |
| `VITE_SENTRY_DSN` | recomendada | monitoramento de erros |
| `VITE_COMPREFACE_URL` | se KYC | tela de KYC |
| `VITE_MIROTALK_URL` | se vídeo | sala de vídeo |
| `VITE_WHATSAPP_GATEWAY_URL` | se WhatsApp | painel admin |
| `VITE_VAPID_PUBLIC_KEY` | se push | inscrição do service worker |
| `VITE_MEMED_ENABLED` | opcional | liga a UI da Memed |
| `VITE_ICP_ENABLED` | opcional | liga a UI de assinatura ICP |
| `VITE_GA_MEASUREMENT_ID` | opcional | Google Analytics |
| `VITE_META_PIXEL_ID` | opcional | Meta Pixel |

### A.2 Backend (Supabase → Edge Functions → Secrets)

Injetados pela plataforma (não configure): `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`.

| Secret | Funções que consomem | Efeito se faltar |
|---|---|---|
| `INTERNAL_FUNCTION_SECRET` | 18 funções internas/cron | automações respondem 401 |
| `SITE_URL`, `SITE_DOMAIN` | `send-email` | links errados nos e-mails |
| `APP_URL` | `mercadopago-create-subscription` | retorno da assinatura quebra |
| `APP_BASE_URL` | `appointment-confirmed`, `appointment-reminders`, `whatsapp-notify` | links dos lembretes quebram |
| `APP_ENV`, `APP_RELEASE`, `GIT_COMMIT_SHA`, `ENVIRONMENT` | `service-health` | painel sem versão |
| `BREVO_API_KEY` | `send-email`, `auth-email-hook`, `service-health` | **nenhum e-mail sai** |
| `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` | `send-email`, `auth-email-hook` | remetente padrão |
| `EMAIL_SUPPORT_ADDRESS`, `EMAIL_COMPANY_ADDRESS` | `send-email` | rodapé incompleto |
| `SEND_EMAIL_HOOK_SECRET` | `auth-email-hook` | **fail-closed** — sem e-mail de auth |
| `RESEND_API_KEY`, `EMAIL_FROM` | `guest-checkout`, `b2b-lead-notification` | esses dois fluxos não notificam |
| `MERCADOPAGO_ACCESS_TOKEN` | criação de pagamento, refund, saque | **não cobra** |
| `MERCADOPAGO_WEBHOOK_SECRET` | `mercadopago-webhook` | **fail-closed** — pagamento nunca confirma |
| `MERCADOPAGO_APP_ID`, `MERCADOPAGO_CLIENT_SECRET` | `mp-oauth-init`, `mp-oauth-callback` | sem split marketplace |
| `PLATFORM_FEE_PERCENT` | `mercadopago-create-payment` | assume 10% |
| `PAGBANK_TOKEN`, `PAGBANK_ENV`, `PAGBANK_ACCOUNT_ID` | funções PagBank | gateway alternativo off |
| `AUTO_PAYOUT_TICK_SECRET` | `auto-payout-tick`, `no-show-reminder-tick` | ticks 401 |
| `MIROTALK_URL`, `MIROTALK_API_KEY` | `mirotalk-token`, `service-health` | sem token → sala sem proteção JWT |
| `COTURN_HOST`, `COTURN_PORT`, `COTURN_USER`, `COTURN_PASS` | `turn-credentials` | **sem TURN** — só STUN |
| `METERED_APP_NAME`, `METERED_SECRET_KEY` | `turn-credentials`, `metered-room` | sem TURN gerenciado |
| `COMPREFACE_URL`, `COMPREFACE_DETECT_KEY`, `COMPREFACE_VERIFY_KEY`, `COMPREFACE_API_KEY` | `didit-kyc`, `compreface-proxy`, `service-health` | **KYC não funciona** |
| `ANTISPOOF_URL`, `ANTISPOOF_API_KEY`, `ANTISPOOF_REQUIRED` | `didit-kyc` | sem detecção de foto/tela |
| `ANTHROPIC_API_KEY` | `didit-kyc`, `pingo-chat`, `clinical-ai` | IA e leitura de documento off |
| `LOVABLE_API_KEY` | `ai-symptom-triage`, `faq-chat-bot` | fallback de IA off |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` | `send-whatsapp`, `whatsapp-qr`, `service-health` | WhatsApp dormente |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `send-push-notification` | push dormente |
| `MEMED_API_KEY`, `MEMED_SECRET_KEY` | `memed-prescriber` | sem receita ICP via Memed |
| `VIDAAS_CLIENT_ID`, `VIDAAS_CLIENT_SECRET` | `vidaas-sign`, `vidaas-callback` | sem assinatura VIDAAS |
| `DOCUSEAL_BASE`, `DOCUSEAL_API_KEY` | `docuseal-proxy` | sem envio de documento |
| `DOCUSEAL_WEBHOOK_SECRET` | `docuseal-webhook` | **fail-closed** |
| `FOCUS_NFE_TOKEN`, `FOCUS_NFE_AMBIENTE`, `NFSE_*` | `emit-nfse`, `nfse-reprocess` | NFS-e dormente |
| `DOCTOR_PROFESSIONAL_ADDRESS` | PDFs de receita e atestado | endereço ausente no documento |
| `INFOSIMPLES_TOKEN` | `verify-council`, `validate-council` | validação de CRM manual |
| `CONSULTA_CRM_API_KEY` | `verify-crm` | validação de CRM manual |
| `ADMIN_BOOTSTRAP_SECRET/EMAIL/PASSWORD` | `create-admin-account` | **fail-closed** (proposital) |
| `ALLOW_TEST_SEED`, `SEED_SECRET` | `seed-test-users`, `seed-test-doctors` | **manter desligado em produção** |

### A.3 Parâmetros do banco (GUC)

| GUC | Definido por | Usado por |
|---|---|---|
| `app.settings.supabase_url` | `ALTER DATABASE` | `invoke_edge_function` |
| `app.settings.service_role_key` | `ALTER DATABASE` | `invoke_edge_function` |
| `app.settings.internal_function_secret` | `ALTER DATABASE` | `invoke_edge_function`, triggers |

### A.4 GitHub Secrets

`SUPABASE_ACCESS_TOKEN`, `CLOUDFLARE_API_TOKEN`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN`, `VPS_SSH_PRIVATE_KEY` (opcional).

---

## Anexo B — Ordem mínima para o MVP no ar

Sequência mais curta que produz uma teleconsulta paga, legal e funcional. Cada camada
destrava a seguinte — não pule.

| Ordem | O que | Sem isso |
|---|---|---|
| 1 | Supabase: projeto, extensões, migrations, GUCs, correção do `invoke_edge_function` | nada funciona |
| 2 | Auth configurada (site URL, redirects, rate limit ≥100/h) | ninguém se cadastra |
| 3 | Brevo + Send Email Hook + SPF/DKIM | ninguém confirma o cadastro |
| 4 | Deploy das 90 Edge Functions + secrets do núcleo | backend inerte |
| 5 | Conta admin (bootstrap) | ninguém aprova médico |
| 6 | Mercado Pago + `MERCADOPAGO_WEBHOOK_SECRET` | não cobra / não confirma |
| 7 | MiroTalk + coturn | sem consulta |
| 8 | CompreFace (+ Anthropic) | bloqueio regulatório do CFM |
| 9 | Frontend no Pages + DNS + CSP revisada | ninguém acessa |
| 10 | Sentry + PITR + restauração ensaiada | opera às cegas e sem rede de proteção |

Depois disso, na ordem de valor: WhatsApp → push → Memed/VIDAAS → NFS-e →
validação automática de CRM → apps móveis.

---

## Anexo C — Achados da revisão do repositório

Revisão de 2026-08-23 sobre o checkout local. Cada item traz onde está e o que fazer.

### C.1 Qualidade do código — estado atual

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | **passa** — 0 erros |
| `npm run lint` | **passa** — 0 erros, 134 avisos (majoritariamente `react-hooks/exhaustive-deps` e um `eslint-disable` sem uso em `guest-checkout`) |
| `npx vitest run` (suíte inteira) | 379 de 380; `src/test/admin-panel.test.tsx > carrega lista de médicos do admin` estourou o timeout de 5000 ms |
| `npx vitest run src/test/admin-panel.test.tsx` (isolado) | **15 de 15 passam** (o teste em questão leva 1372 ms) |
| Escopo | 61 arquivos de teste, 61 páginas, 90 Edge Functions, 312 migrations, 10 workflows |

O teste que falhou passa sozinho: é **flakiness sob concorrência**, não defeito de
produto. Ainda assim quebra o CI quando acontece — vale isolar o arquivo ou elevar o
`testTimeout` dele.

### C.2 Bloqueadores de instalação

**1 — `invoke_edge_function` com a URL de produção fixa no código.**
`supabase/migrations/20260701050200_security_cron_service_role_auth.sql:52` define
`base_url := 'https://pwxvvimdtmvziynbspgx.supabase.co/functions/v1/'`. É a última
definição da função, e ela sobrescreve a versão anterior que lia
`app.settings.supabase_url`. Consequência: **qualquer ambiente novo** (sandbox,
staging, self-host) sai chamando as funções da produção. Correção em
[4.6](#46--corrigir-a-url-fixa-em-invoke_edge_function-ambiente-novo); o ideal é
virar migration versionada.

**2 — `supabase/config.toml` fixa `project_id = "pwxvvimdtmvziynbspgx"`.**
Sempre passe `--project-ref` ou edite o arquivo em ambiente novo.

**3 — Default de produção no cliente.** `src/lib/supabase-config.ts` cai no projeto de
produção quando `VITE_SUPABASE_URL` está vazio. A trava existe só para
`VITE_APP_ENV=sandbox`. Em `dev` sem `.env`, você mexe em produção achando que está
local — o próprio log dos testes mostra o aviso
`"VITE_SUPABASE_URL/... ausentes. Usando defaults publicos de producao."`.
Considere estender a trava para `MODE=development`.

### C.3 Documentação desatualizada

| Documento | Diz | Realidade no checkout |
|---|---|---|
| `README.md` | "Resend (e-mail)" | o provedor é **Brevo**; Resend só em `guest-checkout` e `b2b-lead-notification` |
| `docs/CHECKLIST_CONFIGURACAO.md` | `RESEND_API_KEY` como secret essencial | o essencial é `BREVO_API_KEY` + `SEND_EMAIL_HOOK_SECRET` |
| `docs/ARCHITECTURE.md` | "3 workflows", "87 Edge Functions", deploy por "SCP + docker compose" | **10 workflows**, **90 funções**, deploy via **Cloudflare Pages + Supabase CLI** |
| `docs/READINESS_MATRIX.md` | 306 migrations, 87 functions, 9 workflows | **312**, **90**, **10** |
| `docs/READINESS_MATRIX.md` | gate **Vermelho**: "remover `continue-on-error: true` do job `deploy-supabase`" | o `deploy.yml` atual **não tem** `continue-on-error` — o gate já pode ser reavaliado |
| `docs/GO-LIVE.md` | seção "Vercel — variáveis de ambiente" | o deploy é Cloudflare Pages; `vercel.json` é resíduo |
| `docs/SETUP-COMPREFACE-KYC.md` | "remova `kyc` de `SERVICES_PENDING_SETUP`" | já feito — a lista está vazia |

### C.4 Higiene do repositório

- **Artefatos de build versionados**, apesar do `.gitignore`: `tsconfig.app.tsbuildinfo`,
  `tsconfig.node.tsbuildinfo`, `supabase/.temp/cli-latest`, `supabase/.temp/linked-project.json`.
  Eles aparecem como modificados a cada build e sujam todo diff. Corrija com
  `git rm --cached <arquivo>`.
- **Quatro lockfiles convivendo:** `package-lock.json`, `bun.lock`, `bun.lockb`,
  `deno.lock`. O README e o CI usam npm — os do bun deveriam sair.
- **Arquivos soltos na raiz:** `scripts_tmp_gen.mjs`, `security_best_practices_report.md`
  (não versionado), `SETUP_DADOS_TESTE.sql`, `SUPABASE_SCHEMA.sql`. Movê-los para
  `docs/` ou `scripts/` deixa a raiz legível.
- **`vercel.json`** sem uso no fluxo atual de deploy.

### C.5 Segurança e configuração

- **CSP com conteúdo misto:** `public/_headers` e `nginx.conf` liberam
  `http://72.62.138.208:8000|8042|3001|3200` em página HTTPS. Navegadores bloqueiam
  ou avisam; ou os serviços ganham HTTPS, ou saem da política.
- **CSP com projeto Supabase alheio:** `public/_headers` inclui
  `hikttmmwxcjmzexxhgda.supabase.co` (`https` e `wss`) além do de produção. Remova.
- **CORS `*` nas Edge Functions.** Deliberado, para os subdomínios de tenant
  funcionarem. Se for aplicar allowlist, inclua `https://*.aloclinica.com.br` e os
  domínios próprios, senão os tenants param de chamar as funções.
- **Tokens do Mercado Pago em texto puro** em `doctor_profiles.mp_access_token` /
  `mp_refresh_token`, e o `refresh_token` nunca é usado — o repasse falha em silêncio
  quando o token expira (~180 dias). Já registrado como C4 em
  [`CORRECOES-PENDENTES.md`](CORRECOES-PENDENTES.md); continua aberto.
- **Segredos de exemplo no compose do CompreFace:** `compreface/docker-compose.yml`
  traz a senha do Postgres em claro (`cf_Al0clinica_2026_dbpw`). Troque antes de subir.
- **Pendências externas do relatório de auditoria** (`security_best_practices_report.md`):
  paridade de migrations com o banco de produção, PITR e cópia offsite, testes
  negativos de RLS por perfil, e confirmação/rotação dos secrets no cofre. Nada disso
  o repositório sozinho comprova.

### C.6 Sugestões de próximo passo

1. Transformar a correção do [4.6](#46--corrigir-a-url-fixa-em-invoke_edge_function-ambiente-novo) em migration versionada.
2. Estabilizar `admin-panel.test.tsx` na suíte completa (passa isolado; falha sob concorrência).
3. Atualizar `README.md`, `ARCHITECTURE.md`, `CHECKLIST_CONFIGURACAO.md` e
   `READINESS_MATRIX.md` com os números e o provedor de e-mail corretos.
4. Limpar CSP, lockfiles e artefatos versionados.
5. Reavaliar o gate vermelho da `READINESS_MATRIX.md` — a condição citada não existe mais.

---

**Documentos relacionados:** [`READINESS_MATRIX.md`](READINESS_MATRIX.md) (decisão de
go-live) · [`RUNBOOK.md`](RUNBOOK.md) (incidentes) · [`ARCHITECTURE.md`](ARCHITECTURE.md)
(visão técnica) · [`CONFORMIDADE_CFM.md`](CONFORMIDADE_CFM.md) (CFM 2.314/2022) ·
[`BACKUP_AND_DISASTER_RECOVERY.md`](BACKUP_AND_DISASTER_RECOVERY.md) ·
[`MOBILE_RELEASE_GUIDE.md`](MOBILE_RELEASE_GUIDE.md) · [`SANDBOX.md`](SANDBOX.md).
