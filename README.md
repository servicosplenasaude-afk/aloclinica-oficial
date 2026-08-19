# AloClínica — Plataforma de Telemedicina

Plataforma de telemedicina para o Brasil: **teleconsulta por vídeo, agendamento, prontuário eletrônico, prescrição/atestado digital e pagamentos**, em conformidade com a Resolução **CFM nº 2.314/2022** e a **LGPD**.

> PJ: ALO CLINICA MEDICA LTDA · CNPJ 66.474.468/0001-26 · Responsável Técnica: Dra. Tâmara Oliveira Vieira (CRM 2352/RR).

---

## 🧱 Stack

| Camada | Tecnologias |
|---|---|
| **Frontend** | React 18 · TypeScript · Vite · Tailwind + shadcn/radix · React Router · TanStack Query · PWA · Capacitor (Android/iOS) · Sentry |
| **Backend** | **Supabase** — Postgres (RLS), Auth (GoTrue), Storage, **Edge Functions (Deno)**, pg_cron |
| **Integrações** | Mercado Pago (pagamentos) · Anthropic (IA clínica) · MiroTalk + coturn (vídeo) · Memed (prescrição ICP-Brasil) · Evolution API (WhatsApp) · Resend (e-mail) |
| **Deploy** | Docker + nginx (frontend) · Easypanel/Traefik (TLS) · VPS · Supabase (backend gerenciado) |

## 🏗️ Arquitetura

```
Navegador / App (Capacitor)
        │  HTTPS
        ▼
Frontend SPA (React) ── nginx no container Docker ── Traefik (TLS) ── VPS
        │
        │  supabase-js (Auth JWT + RLS)
        ▼
Supabase ─ Postgres (RLS por perfil) · Auth · Storage · Edge Functions (Deno)
        │
        ├─ Mercado Pago (pagamento de consulta — preço autoritativo no servidor)
        ├─ Memed (assinatura ICP-Brasil da receita)
        ├─ MiroTalk/coturn (vídeo da consulta)
        └─ Anthropic (assistência clínica por IA)
```

- **Perfis (RBAC):** paciente, médico, clínica, admin, suporte — controle real por **RLS** no banco (o RoleGuard do front é só UX).
- **Prontuário:** imutável (DELETE bloqueado por RLS RESTRICTIVE); retenção mínima 20 anos (CFM 1.821/2007).
- **Consentimento (TCLE):** registrado em `patient_consents` antes da teleconsulta.

## 🚀 Setup local

Requisitos: Node.js 20+.

```sh
git clone https://github.com/aloclinica/aloclinica.git
cd aloclinica
npm ci
cp .env.example .env   # preencha as variáveis (ver abaixo)
npm run dev            # http://localhost:8080
```

Outros comandos: `npm run build` (produção) · `npm run lint` · `npm test` (Vitest) · `npm run test:e2e` (Playwright).

## 🔑 Variáveis de ambiente

**Frontend (build-time, `VITE_*`):** já têm default público embutido (projeto Supabase de produção). Para sobrescrever:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SENTRY_DSN=            # opcional
VITE_MERCADOPAGO_PUBLIC_KEY=
```

**Backend (Supabase → secrets das Edge Functions):**
```
SUPABASE_SERVICE_ROLE_KEY   MERCADOPAGO_ACCESS_TOKEN   ANTHROPIC_API_KEY
INTERNAL_FUNCTION_SECRET     MEMED_API_KEY / MEMED_SECRET_KEY   EVOLUTION_API_KEY / URL
COMPREFACE_URL/VERIFY_KEY/DETECT_KEY (HTTPS)   DOCTOR_PROFESSIONAL_ADDRESS (fallback)
```

## 📦 Deploy

**Frontend (VPS):** o workflow `.github/workflows/deploy.yml` gera `dist/`, envia
os artefatos à VPS e recria o container `aloclinica-web`; o Traefik termina TLS.
```sh
docker build -t aloclinica-web .
docker run -d --name aloclinica-web --restart unless-stopped -p 127.0.0.1:8080:80 aloclinica-web
# Em produção, o roteamento/TLS é administrado pelo Easypanel/Traefik.
```

**Backend (Supabase):**
1. Migrações: aplicar `supabase/migrations/*` (`supabase db push`) ou colar `docs/APLICAR_NO_SUPABASE.sql` no SQL Editor.
2. Edge Functions: `supabase functions deploy` (requer Access Token `sbp_`).
3. Secrets: `supabase secrets set ...` para as chaves acima.

**DNS:** registro A de `aloclinica.com.br` → IP da VPS.

## ⚖️ Conformidade

- **CFM 2.314/2022:** ver [`docs/CONFORMIDADE_CFM.md`](docs/CONFORMIDADE_CFM.md) (mapa item a item do roteiro de vistoria).
- **LGPD:** dados de saúde (art. 11) com RLS por perfil, logs de auditoria de acesso, portabilidade/eliminação, consentimento registrado.
- **Segurança:** ver [`docs/`](docs/) — hardening de auth (anti auto-admin), preço de pagamento autoritativo no servidor, endpoints internos fail-closed, assinatura de documentos honesta (ICP-Brasil via Memed).

## 📁 Estrutura

```
src/
  components/   # UI por domínio (consultation, patient, doctor, admin, landing, ...)
  pages/        # rotas (React Router)
  hooks/  lib/  contexts/  config/   # lógica, utilidades, estado, config de compliance
  integrations/supabase/             # cliente Supabase (tipos gerados)
supabase/
  functions/    # Edge Functions (Deno) — pagamento, PDFs, IA, notificações
  migrations/   # schema + RLS + políticas
docs/           # RUNBOOK, conformidade, deploy, auditorias
```

O checkout contém **87 Edge Functions implantáveis** (diretórios com `index.ts`,
excluindo `_shared`). A contagem e os gates objetivos de lançamento estão em
[`docs/READINESS_MATRIX.md`](docs/READINESS_MATRIX.md); ela mede o repositório e
não presume que todas estejam implantadas no ambiente remoto.

## 📄 Licença

Software proprietário — ALO CLINICA MEDICA LTDA. Todos os direitos reservados.
