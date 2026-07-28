# Guia de Go-Live — AloClínica

Checklist para colocar a plataforma no ar com segurança. O **software está pronto e
deployado**; o que falta abaixo é **configuração de infraestrutura e ações operacionais**
que só você (ou o contador/TI) pode fazer. Ordem sugerida: faça os 🔴 **críticos** primeiro.

---

## 🔴 1. Brevo — verificar o domínio de e-mail (BLOQUEADOR Nº 1)
Sem isto, **nenhum e-mail transacional sai** (confirmação de consulta, recibo, aprovação de
médico, redefinição de senha). A chave (`BREVO_API_KEY`) já está configurada — falta **verificar
o domínio** `telemedicinaaloclinica.sbs` no Brevo.

Passos (no painel do Brevo):
1. Acesse **Settings → Senders, Domains & Dedicated IPs → Domains**.
2. Adicione o domínio `telemedicinaaloclinica.sbs` (o mesmo do `EMAIL_FROM_ADDRESS`).
3. O Brevo mostra registros **SPF, DKIM e DMARC** — adicione-os no DNS do domínio
   (onde o domínio está registrado/hospedado).
4. Aguarde a propagação e clique em **Authenticate/Verify** no Brevo até ficar verde.
5. Teste: crie uma conta de paciente de teste e confirme que o e-mail de boas-vindas chega.

> Se preferir enviar do `aloclinica.com.br`, verifique **esse** domínio no Brevo e ajuste o
> secret `EMAIL_FROM_ADDRESS` no Supabase para um endereço desse domínio.

---

## 🔴 2. Vercel — variáveis de ambiente do build
No projeto na Vercel → **Settings → Environment Variables** (produção):
- `VITE_SENTRY_DSN` = o DSN do seu projeto Sentry → **sem isto o lançamento fica sem
  monitoramento de erros** (você não fica sabendo de telas que quebram).
- Confirme `SITE_DOMAIN=aloclinica.com.br` e `SITE_URL=https://aloclinica.com.br` (os links
  dos e-mails usam isso; já corrigi o padrão do código, mas o valor do secret manda).

Depois, faça um **redeploy** na Vercel para as variáveis entrarem.

---

## 🔴 3. Rotacionar credenciais expostas
Tokens/chaves que já circularam (em chats, prints, repositórios) devem ser **trocados** para
invalidar cópias antigas. Priorize os sensíveis:
- `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Settings → API → rotate) e o **access token** de
  gerência (`sbp_...`) usado nas automações.
- `MERCADOPAGO_ACCESS_TOKEN` + `MERCADOPAGO_WEBHOOK_SECRET` (painel do Mercado Pago).
- `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE_TOKEN` (WhatsApp).
- `MEMED_API_KEY` / `MEMED_SECRET_KEY`, `ANTHROPIC_API_KEY`, `BREVO_API_KEY`.
Atualize cada um nos **Secrets do Supabase** e faça o redeploy das edge functions se necessário.

---

## 🟠 4. WhatsApp — parear a instância (escanear o QR)
1. Entre como **admin** na plataforma → painel de **WhatsApp** (Admin).
2. Gere o **QR code** e escaneie com o WhatsApp da clínica (o número oficial).
3. Confirme o status "conectado". Sem isto, os avisos por WhatsApp ficam em modo dev
   (não enviam).

---

## 🟠 5. MiroTalk — habilitar o JWT do vídeo (defesa extra)
O código já anexa o token; falta ligar a exigência no **servidor MiroTalk**.
Passo a passo completo em **`docs/security/REMEDIATION-mirotalk-jwt.md`** (variáveis
`JWT_KEY`, `API_KEY_SECRET`, `HOST_PROTECTED` no container + reiniciar + testar).
> Não é bloqueador: o vetor principal já está fechado pelo segredo de sala. É camada extra.

---

## 🟠 6. Conformidade / operacional (contador)
- **Inscrição municipal** (Boa Vista/RR) para emissão de NFS-e. Enquanto não houver, a
  emissão de nota fica **dormante** (não quebra o pagamento). Ao regularizar, configure os
  secrets `NFSE_*` / Focus NFe.
- **CRM-PJ** (registro da pessoa jurídica no Conselho) + **Responsável Técnico (RT)** — exigência
  do CFM para a clínica operar.
- Rever a **DPA** e a designação de RT (modelos em `docs/compliance/`).

---

## 🧪 7. Validar com 1 consulta de teste (2 contas)
Antes de divulgar, faça **uma teleconsulta de teste** com 2 contas (1 médico aprovado + 1
paciente):
- **Vídeo**: confirmar que os dois se conectam normalmente (o segredo de sala está no ar com
  fallback — sem regressão). Se a chamada cair no MiroTalk, validar o JWT (item 5).
- **PII de médico no diretório** (achado de segurança de nível médio): aplicar o patch pronto
  em **`docs/security/REMEDIATION-doctor-directory-pii.md`** — precisa de uma conta de médico
  de teste para validar que o diretório continua mostrando os nomes.

---

## ✅ Checklist final (marque antes de divulgar)
- [ ] Brevo: domínio verificado + e-mail de teste chegou.
- [ ] Vercel: `VITE_SENTRY_DSN` + `SITE_DOMAIN` setados + redeploy feito.
- [ ] Credenciais rotacionadas e atualizadas nos secrets.
- [ ] WhatsApp pareado (QR escaneado, status conectado).
- [ ] MiroTalk JWT ligado e testado (opcional, defesa extra).
- [ ] CRM-PJ + RT + inscrição municipal encaminhados.
- [ ] 1 teleconsulta de teste ponta a ponta OK (agendar → pagar → vídeo → receita).
- [ ] Patch de diretório (PII de médico) aplicado com médico de teste.
- [ ] Um pagamento de teste (PIX e cartão) confirmado ponta a ponta.

Quando todos estiverem ✅, a plataforma está pronta para receber pacientes reais.
