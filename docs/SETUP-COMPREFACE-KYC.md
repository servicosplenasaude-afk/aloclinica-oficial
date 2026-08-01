# Como ligar o KYC facial (CompreFace) antes do lançamento

> **Status atual:** o KYC facial **não está no ar**. O subdomínio
> `face.aloclinica.com.br` não existe no DNS e não há rota no servidor.
> Isso **não afeta usuários hoje** (pré-lançamento, 0 cadastros), mas
> **precisa estar de pé antes do lançamento oficial** — o CFM exige
> verificação de identidade em telemedicina.
>
> Enquanto não é configurado, o monitor (Admin → Saúde Sistema) mostra o KYC
> como **"pendente de configuração"** (âmbar), não como falha.

Este guia é para quem tem acesso ao **EasyPanel** e ao **Cloudflare**. Leva ~15 min.

---

## O que você vai precisar
- Acesso ao **EasyPanel**: `http://72.62.138.208:3000`
- Acesso ao **Cloudflare** (o DNS do domínio está lá): entre em
  `https://dash.cloudflare.com` — provavelmente com o e-mail **plenasaude@gmail.com**
  (os nameservers do domínio são `fonzie.ns.cloudflare.com` / `marlowe.ns.cloudflare.com`).

---

## Passo 1 — Verificar/subir o serviço CompreFace no EasyPanel
1. Entre no EasyPanel (`http://72.62.138.208:3000`).
2. Abra o projeto do AloClínica e procure um serviço chamado **compreface**
   (ou `compreface-fe`, `compreface-api`, `compreface-core`).
   - **Se existir:** confira se está **rodando** (verde). Se estiver parado,
     clique em **Start/Deploy**.
   - **Se NÃO existir:** o CompreFace precisa ser instalado. É um app de
     4 containers (postgres + api + core + fe). Use o `docker-compose` oficial
     do CompreFace (https://github.com/exadel-inc/CompreFace) como template no
     EasyPanel. ⚠️ Ele consome ~2 GB de RAM — confira que o VPS tem folga
     (o VPS já caiu antes por falta de memória com vários serviços juntos).
3. No serviço **compreface-fe** (o "frontend", porta 80), vá em **Domains**
   e adicione o domínio: `face.aloclinica.com.br` (com HTTPS/Let's Encrypt).

## Passo 2 — Criar o DNS no Cloudflare
1. Entre em `https://dash.cloudflare.com` e selecione o domínio **aloclinica.com.br**.
2. Vá em **DNS → Records → Add record**:
   - **Type:** `A`
   - **Name:** `face`
   - **IPv4 address:** `72.62.138.208`
   - **Proxy status:** siga o mesmo padrão do registro que já funciona
     (veja como está o registro do site `aloclinica.com.br` e copie —
     provavelmente **Proxied**, nuvem laranja).
   - Salve.
3. Espere 1–5 min para propagar.

## Passo 3 — Conferir os segredos do KYC (Supabase)
No Supabase (Edge Functions → Secrets), confirme que existem e estão corretos:
- `COMPREFACE_URL` = `https://face.aloclinica.com.br`
- `COMPREFACE_API_KEY`, `COMPREFACE_DETECT_KEY`, `COMPREFACE_VERIFY_KEY`
  (gerados dentro do painel do CompreFace, em cada serviço de reconhecimento).

## Passo 4 — Validar
- No navegador: abrir `https://face.aloclinica.com.br` deve carregar a tela do CompreFace.
- No app: **Admin → Saúde Sistema** → o **KYC facial** deve ficar **verde (ATIVO)**.
- Depois, **remova `"kyc"`** de `SERVICES_PENDING_SETUP` em
  `src/config/service-status.ts` e publique, para o monitor voltar a tratar o
  KYC como crítico (aí sim dispara alerta se cair de verdade).

---

### Dúvidas comuns
- **"Não sei se tenho Cloudflare."** Tem sim — o DNS do domínio está lá.
  Entre com `plenasaude@gmail.com`. Se a senha não funcionar, use
  "Esqueci a senha" nesse e-mail.
- **"E se o VPS não aguentar a RAM?"** Considere um plano de VPS maior antes de
  subir o CompreFace, ou usar um provedor de KYC gerenciado (ex.: Didit) —
  o código já tem a função `didit-kyc` como alternativa.
