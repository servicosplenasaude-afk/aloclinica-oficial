# AloClínica — Checklist histórico de Go-Live (estado relatado em 2026-07)

> Este arquivo preserva o relato operacional de julho e pode estar desatualizado.
> A decisão atual deve usar [`READINESS_MATRIX.md`](READINESS_MATRIX.md), com
> evidência nova por gate; itens “verificados ao vivo” abaixo não são prova da
> release de agosto.

Status consolidado após a vistoria. O que **funciona**, e o que **falta** (com passos).

## ✅ Já funcionando (verificado ao vivo)
- **Segurança**: ~12 críticas + >10 altas corrigidas e no ar (gates 401 confirmados); RLS forte; backdoor de admin removido; 29 crons protegidos e rodando.
- **Frontend** novo na VPS (atrás da manutenção), healthy.
- **Pagamento núcleo** (Mercado Pago): paciente paga PIX/cartão/boleto e o webhook confirma. Token de produção real.
- **Validação de médico (CRM)**: automática via consultacrm (chave real ativa).
- **KYC facial de paciente**: CompreFace + OCR (Claude) — no ar.
- **IA** (Claude/Lovable) e **e-mail** (Brevo): reais.
- **Validação multi-conselho** (`verify-council`): pronta — ativa quando a conta Infosimples tiver saldo.
- **~21 tabelas recuperadas** (6 das functions + ~15 do frontend).

---

## 🔴 Pendências CRÍTICAS (você)

### 1. Rotacionar segredos expostos no chat
- **GitHub PAT** (`ghp_…`): GitHub → Settings → Developer settings → Personal access tokens → Revoke.
- **Supabase access token** (`sbp_…`): supabase.com/dashboard/account/tokens → Revoke.
- **service_role key**: Supabase → Settings → API → Roll (os crons usam segredo interno, não quebram).

### 2. Assinatura legal (receita/atestado) — escolher UM
As chaves VIDAAS e Memed hoje são **placeholder** (não funcionam). Opções:
- **Memed** (menor fricção): pegar `api-key`+`secret-key` reais → me passar → eu ativo (endpoint já corrigido).
- **VIDAAS / A3 Remoto** (ICP-Brasil): pegar credenciais reais (client_id/secret) → me passar → eu ativo (código pronto).
- Sem isso: receita/atestado não saem assinados juridicamente.

---

## 🟠 Pendências IMPORTANTES (você → eu ativo)

### 3. Saldo na Infosimples → liga validação de TODOS os conselhos
- Conta Infosimples → **adicionar saldo** (pré-pago). Token já configurado e testado; falta só o crédito.
- Me avisa → eu re-testo cada conselho (CRP, CRO…) ao vivo.

### 4. Conectar o WhatsApp (WAHA)
- Está em `SCAN_QR_CODE` (não conectado). Entre no dashboard do WAHA (`https://whatsapp.telemedicinaaloclinica.sbs`, login em `WAHA_DASHBOARD_*`) e **escaneie o QR** com o número comercial.
- Sem isso: lembretes/confirmações por WhatsApp não saem.

### 5. Mercado Pago — repasse aos médicos (marketplace)
- Faltam `MERCADOPAGO_APP_ID` + `MERCADOPAGO_CLIENT_SECRET` (painel dev do MP → sua aplicação).
- Redirect URI da app: `https://pwxvvimdtmvziynbspgx.supabase.co/functions/v1/mp-oauth-callback`.
- Me passa os dois → eu testo o fluxo de OAuth/repasse (`mp-oauth-init` já pronto).

---

## 🟡 Pendências MENORES

### 6. Segredos do CI (deploy automático futuro)
Hoje eu faço deploy direto. Pra o GitHub Actions deployar sozinho no merge, configure (Settings → Secrets → Actions): `SUPABASE_ACCESS_TOKEN`, `VPS_SSH_PRIVATE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN`.

### 7. Tirar da manutenção
Quando validar pagamento + fluxos principais, é só me pedir "**volta o site**" que eu reverto o Traefik.

---

## Mapa de integrações (real vs placeholder)
| Integração | Estado |
|---|---|
| Mercado Pago (pagamento) | ✅ real |
| CompreFace (KYC) · Claude/Lovable (IA) · Brevo (e-mail) | ✅ real |
| consultacrm (CRM) | ✅ real (ativo) |
| Infosimples (multi-conselho) | ✅ token real — **sem saldo** |
| VIDAAS / Memed (assinatura) | ❌ placeholder |
| Resend (e-mail) | ❌ placeholder (Brevo cobre) |
| MERCADOPAGO_APP_ID/CLIENT_SECRET (repasse) | ❌ falta |
| WhatsApp (WAHA) | ⏳ falta escanear QR |
