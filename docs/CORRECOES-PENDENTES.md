# Correções que dependem de você / infra / aplicação cuidadosa

Este documento lista os itens do **estudo da plataforma** que **não** foram
aplicados diretamente no código pelo Claude — porque dependem de infraestrutura,
de acesso ao Supabase/servidor, ou porque mexer às cegas poderia quebrar um fluxo
legítimo em produção. Cada item traz o **porquê**, o **como** e o **risco**.

> As correções que JÁ foram feitas no código (e sobem pelo Lovable/Pages) estão
> nos commits `fix(...)` recentes: endpoints C3/C5/C6, idempotência A5, replay A6,
> ícones A10, CI/tipos C7, autoaprovação C1 (migration), landing A7, pisca M18.

---

## 🔴 Prioridade máxima (antes do lançamento)

### C2 — Confirmar o estado real do banco em produção (Advisor)
**Por quê:** há prova de "drift" — migrations que declaram que tabelas/políticas
nunca foram aplicadas neste projeto Supabase. Ou seja, proteções que existem nos
arquivos podem **não** estar no banco ao vivo (inclui a correção A1 de
`health_metrics` e a nova C1 de autoaprovação).
**Como:**
1. Supabase → seu projeto → **Advisors** (Security Advisor) → rodar e revisar.
2. No **SQL Editor**, conferir políticas críticas, ex.:
   ```sql
   select tablename, policyname, cmd, qual
   from pg_policies
   where tablename in ('doctor_profiles','health_metrics','profiles','activity_logs')
   order by tablename, policyname;
   ```
3. Confirmar que o gatilho da C1 existe:
   ```sql
   select tgname from pg_trigger where tgrelid = 'public.doctor_profiles'::regclass;
   -- deve conter zzz_protect_doctor_verification
   ```
**Validar a C1:** logado como médico comum, tentar `update doctor_profiles set
crm_verified=true where user_id = auth.uid()` — o valor **não** pode mudar.

### C4 — Criptografar os tokens do Mercado Pago (+ renovação)
**Por quê:** `doctor_profiles.mp_access_token`/`mp_refresh_token` estão em texto
puro. Vazamento do banco = controle da conta MP de cada médico. E não há uso do
`refresh_token` → quando expira (~180 dias) o repasse falha em silêncio.
**Como (para um dev):** mover os tokens para o **Supabase Vault** (ou cifrar com
`pgsodium`); criar um job (cron) que renova o access_token antes do vencimento
usando o refresh_token; restringir leitura da coluna a service_role.
**Risco:** médio — mexe no fluxo de pagamento; testar em staging.

### C8 — Ligar o KYC (CompreFace)
Já documentado em **`docs/SETUP-COMPREFACE-KYC.md`**. Sem ele, agendar/consultar
trava para usuários reais.

---

## 🟠 Alto (infra / servidor)

### A2 — Exigir token na sala de vídeo (MiroTalk)
**Por quê:** o MiroTalk self-hosted não exige JWT e os canais Realtime não são
privados → terceiro que saiba o nome da sala pode entrar na consulta.
**Como:** no container do MiroTalk, ligar `HOST_PROTECTION`/`JWT` (token por sala);
no app, usar canais Realtime com `{ config: { private: true } }`.

### A3 / A4 — Mixed content na CSP (HTTP num site HTTPS)
**Por quê:** `public/_headers` ainda libera `http://72.62.138.208:8000/8042/3001/
3200` (KYC/vídeo/serviços) — tráfego interceptável e quebra do HTTPS.
**Como:** dar **HTTPS próprio** (subdomínio + cert) a cada serviço do VPS (via
EasyPanel/Traefik) e então **remover** esses endereços `http://IP:porta` do
`connect-src`/`frame-src` em `public/_headers`. O arquivo já marca isso como TODO.

### A9 — `send-whatsapp` cai para HTTP em erro de TLS
**Por quê:** quando o certificado do servidor Evolution é inválido, a função
reenvia por `http://` → PII médica em texto claro. **Não removi o fallback** porque
isso quebraria o WhatsApp enquanto o cert estiver ruim.
**Como:** corrigir o certificado TLS do servidor Evolution (Let's Encrypt no
EasyPanel) e então remover o bloco de fallback HTTP em `send-whatsapp/index.ts`.

### B3 — Rotacionar chaves expostas
**Por quê:** a `service_role` do Supabase e os tokens do Cloudflare foram
compartilhados no chat (ficam registrados).
**Como:** Supabase → Settings → API → **roll** da service_role (e atualizar onde
usa); Cloudflare → My Profile → API Tokens → revogar os tokens usados.

---

## 🟡 Médio — recomendações (confirmar o caso de uso antes)

> Estes eu **não** apliquei porque podem quebrar comportamento intencional.
> Cada um traz a correção recomendada + a ressalva.

- **M1 — Otimizar imagens (25 MB de site).** `mascot-animated.mp4` (5.6 MB),
  vários PNG de 1–1.6 MB, `logo.png` (1.2 MB). **Como:** adicionar
  `vite-plugin-image-optimizer` ao build (comprime no deploy) **ou** comprimir/
  converter os arquivos para webp/avif e o vídeo para menor bitrate. (A logo vai
  mudar de qualquer forma — comprimir a nova ao subir.)
- **M5 — Trilha de auditoria forjável.** `activity_logs` aceita INSERT de qualquer
  um (`WITH CHECK (true)`). **Recomendado:** gravar auditoria só via service_role/
  edge. **Ressalva:** confirmar que nenhuma tela grava `activity_logs` direto do
  cliente antes de restringir.
- **M6 — Fila de urgência visível a qualquer médico.** `on_demand_queue` deixa
  qualquer médico ver a fila com sintomas. **Provavelmente intencional** (triagem
  aberta do plantão 24h). **Recomendado:** se não for, escopar por vínculo; se for,
  documentar como decisão.
- **B1 — Presença de usuários pública.** `user_presence` visível a qualquer
  autenticado. **Ressalva:** pode alimentar indicador "online" mostrado ao
  paciente — confirmar antes de escopar.
- **A11 — Dois sistemas de pagar médico.** `withdrawal_requests` (saque automático)
  vs `doctor_payouts` (marcar pago manual) não se cruzam → risco de pagamento
  duplicado. **Recomendado:** unificar ou fazer um checar o outro. (Refactor — dev.)
- **A12 — Onboarding de médico em 4 telas admin.** Consolidar Aprovações + KYC +
  Candidaturas + Funil num fluxo único. (UX admin — projeto à parte.)

---

## 🟢 Baixo — dívida técnica (backlog para um dev)

- **M14 — ~850 usos de `any` + componentes gigantes** (VideoRoom 1897 linhas,
  BookAppointment 1589, PatientEMR 1379). Ligar `strict` por pasta e quebrar os
  "god components". Refactor gradual.
- **M16 — Muitas superfícies de prescrição** (6+ componentes) e financeiro do
  médico duplicado (Ganhos vs Carteira). Consolidar.
- **Código morto / seeds:** `guest-checkout` (410), `process-refund` (legado),
  `seed-test-doctors`/`seed-test-users` (já desabilitados por env, mas idealmente
  removidos do deploy), caminho local fixo em `mcp/index.ts` (autogerado — some
  quando o Lovable regenerar).
- **Libs redundantes:** `gsap` (só 6 usos, `framer-motion` é o padrão) e duas libs
  de QR. Consolidar corta peso do bundle.
- **i18n incompleto** (seletor de idioma engana; conteúdo é pt-BR fixo).

---

_Gerado a partir do estudo completo da plataforma. As correções de código já
aplicadas estão no histórico do Git; estas aqui dependem de acesso/infra/decisão._
