# Migrar o site para o Cloudflare Pages (serviços continuam no VPS)

**Objetivo:** tirar o *site* (o app React) do VPS e colocá-lo no **Cloudflare Pages**
(grátis, global, build na nuvem). O VPS passa a rodar **só os serviços pesados**
(CompreFace/KYC, WhatsApp, vídeo) — com RAM sobrando, sem o risco de crash que já
aconteceu ao buildar o site + subir o CompreFace juntos.

```
ANTES                                 DEPOIS
┌─────────── VPS (8 GB) ──────────┐   ┌── Cloudflare Pages ──┐   ┌──── VPS ────┐
│ site (build pesado) + serviços  │   │ site (app React)     │   │ só serviços │
│  ↳ estoura a RAM                │   │  grátis, global CDN  │   │  RAM sobra  │
└─────────────────────────────────┘   └──────────────────────┘   └─────────────┘
        Supabase (banco/auth/funções) — não muda em nada
```

---

## ✅ Já deixei pronto no código
- `public/_redirects` — roteamento SPA (senão links diretos dariam 404).
- `public/_headers` — **corrigi o CSP** (a versão antiga apontava para o Supabase
  ERRADO e teria bloqueado o banco no Pages). Agora está igual ao que roda hoje.

## Pré-requisitos
- Acesso ao **Cloudflare** na conta que tem o `aloclinica.com.br`
  (provavelmente **plenasaude@gmail.com** — sem "bv"; a conta "bv" está vazia).
- O repositório no GitHub: `aloclinica/aloclinica`.

---

## Passo 1 — Criar o projeto no Cloudflare Pages
1. Em `https://dash.cloudflare.com` → menu lateral **Compute (Workers & Pages)** →
   **Create** → aba **Pages** → **Connect to Git**.
2. Autorize o GitHub e escolha o repositório **aloclinica/aloclinica**, branch **main**.
3. **Build settings:**
   - Framework preset: **Vite** (ou "None")
   - Build command: `npm run build`
   - Build output directory: `dist`
   - (Variável de ambiente) `NODE_VERSION` = `20`
4. **Environment variables** (opcional — o Supabase já tem fallback no código, então
   o site funciona mesmo sem nada; configure para ativar tudo):
   | Variável | Para quê | Obrigatória? |
   |---|---|---|
   | `VITE_SUPABASE_URL` | banco | não (tem fallback) |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | banco | não (tem fallback) |
   | `VITE_MERCADOPAGO_PUBLIC_KEY` | pagamentos | recomendado |
   | `VITE_SENTRY_DSN` | monitoramento de erros | opcional |
   | `VITE_GA_MEASUREMENT_ID` / `VITE_META_PIXEL_ID` | analytics | opcional |
   | `VITE_COMPREFACE_URL` | KYC | opcional (tem fallback) |
   > Os valores são os mesmos do arquivo `.env` atual / painel do Lovable. São
   > chaves **públicas** (client) — nunca coloque aqui access tokens/segredos.
5. Clique **Save and Deploy**. O primeiro build sai em ~2 min e gera um link de
   teste tipo `aloclinica.pages.dev`.

## Passo 2 — Testar no link de teste (antes de virar o domínio)
Abra o `*.pages.dev` e confira, **sem pressa**:
- Home carrega, imagens/logo aparecem.
- Login de paciente/admin funciona (banco conectando = CSP ok).
- `/agendar` abre e navega (roteamento SPA ok).
- Sem erros vermelhos no console (F12) de CSP/conexão.

## Passo 3 — Apontar o domínio (a virada)
1. No projeto do Pages → **Custom domains** → **Set up a custom domain** →
   digite `aloclinica.com.br` → **Continue/Activate**.
2. Como o DNS **já está no Cloudflare**, ele ajusta o registro sozinho. Faça o
   mesmo para `www.aloclinica.com.br` se usar.
3. Em minutos o site passa a ser servido pelo Pages. O SSL é automático.

## Passo 4 — Liberar RAM no VPS (o pulo do gato)
Depois que o site estiver 100% no Pages:
1. No **EasyPanel**, **pare/remova o serviço do site** (o que buildava o app).
2. Agora sobra memória → dá para **ligar o CompreFace/KYC** com segurança
   (ver `docs/SETUP-COMPREFACE-KYC.md`).
> Assim os **dois problemas se resolvem juntos**: site fora do VPS + RAM para o KYC.

---

## ⚠️ Pontos de atenção (honestos)
- **Deploy vira automático:** todo push no GitHub (inclusive os do **Lovable**)
  passa a publicar sozinho no Pages. É bom (tem histórico e *rollback* no painel),
  mas exige combinar o fluxo com o Lovable para não subir algo quebrado. O Pages
  gera **preview** de cada mudança antes de virar produção — dá para revisar.
- **Deploy do VPS deixa de ser usado** para o site (o gatilho antigo). Mantê-lo não
  atrapalha, mas o "oficial" passa a ser o Pages.
- **CSP:** ainda tem endereços antigos (`http://72.62.138.208:PORTA` e o domínio de
  vídeo `meet.telemedicinaaloclinica.sbs`). Mantidos para não quebrar nada agora;
  limpar quando os serviços ganharem HTTPS próprio (ex.: `face.aloclinica.com.br`).
- **PWA/service worker:** funciona igual no Pages; a atualização do app já é tratada
  pelo próprio site (banner de atualização).

## Rollback (se algo der errado)
Enquanto o site antigo do VPS continuar de pé, é só **remover o custom domain** do
Pages que o `aloclinica.com.br` volta a apontar para o VPS. Zero risco de ficar sem site.
