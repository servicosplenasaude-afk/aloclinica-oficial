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
- ✅ **CRM-PJ** (registro da pessoa jurídica no Conselho) — **CONCLUÍDO** (CRM-PJ **nº 680/RR**,
  classificação Telemedicina, Diretora Técnica Dra. Tâmara Oliveira Vieira, regular até 17/07/2027).
  O dado público no app (rodapé, termos, `/responsavel-tecnico`) já foi atualizado.
- Rever a **DPA** e a designação de RT (modelos em `docs/compliance/`).

### 🧾 6.1 Nota Fiscal (NFS-e) — ligar a emissão automática

> **⚠️ Boa Vista/RR usa a NFS-e NACIONAL** (ambiente nacional, endpoint `/v2/nfsen` da Focus),
> não o padrão municipal. Isso foi confirmado direto na Focus em 28/07/2026. Duas consequências:
> 1. **No painel da Focus, o contador precisa habilitar "Ambiente da NFSe Nacional"** na empresa
>    (flags `habilita_nfsen_homologacao` + `habilita_nfsen_producao = true` e `habilita_nfse = false`).
>    Isso **só dá para fazer no painel/conta da Focus** — os tokens da empresa não alteram essa config.
> 2. O código de emissão será **adaptado para o padrão nacional** (`/v2/nfsen`) — feito pelo
>    desenvolvedor assim que a empresa estiver habilitada e o **código de tributação nacional**
>    da teleconsulta for informado (no padrão nacional não se usa o "item 4.05" antigo).
>
> **Status dos tokens (28/07):** o **token de produção** cadastrado é **válido** ✅. O **token de
> homologação** também foi validado. Falta só habilitar o ambiente nacional na empresa (item 1 acima)
> + o código de tributação nacional, e então rodar 1 nota de teste.

A plataforma **já emite, registra e envia** a NFS-e sozinha (por consulta e por plantão):
grava cada nota, mostra ao paciente (recibo/detalhe/histórico), tem tela de gestão no Admin
(**Operação → Notas Fiscais**) e um reprocessador automático a cada 15 min. Tudo isso fica
**dormante (fail-open)** — não emite e **não quebra o pagamento** — até a configuração fiscal
ser concluída. Para **ligar** (após habilitar o ambiente nacional acima):

1. **Inscrição municipal** (Boa Vista/RR) da empresa (CNPJ) habilitada a emitir NFS-e.
2. Criar conta na **Focus NFe** (focusnfe.com.br), cadastrar a empresa e enviar o
   **certificado digital A1** (.pfx) no painel da Focus.
3. Preencher os **secrets** no Supabase (Settings → Edge Functions → Secrets):
   - `FOCUS_NFE_TOKEN` — token da Focus (produção).
   - `FOCUS_NFE_AMBIENTE` = `producao` (use `homologacao` para testar antes).
   - `NFSE_CNPJ` — CNPJ da clínica (só números).
   - `NFSE_INSCRICAO_MUNICIPAL` — inscrição municipal.
   - `NFSE_CITY_IBGE` — código IBGE do município (Boa Vista/RR = `1400100`).
   - `NFSE_ITEM_LISTA_SERVICO` — item da lista de serviço (o contador informa; telemedicina
     costuma ser **4.05** — "Aquisição/atenção domiciliar/serviços de saúde"; confirme com ele).
   - `NFSE_CODIGO_TRIBUTARIO_MUNICIPIO` — código de tributação do município (o contador informa).
   - `NFSE_ISS_RATE` — alíquota de ISS (ex.: `2` para 2%).
   - `NFSE_SERVICE_DESC` (opcional) — descrição do serviço na nota.
4. Testar em `homologacao` (1 consulta paga → conferir a nota na tela **Notas Fiscais**),
   depois trocar `FOCUS_NFE_AMBIENTE` para `producao`.

> A partir daí, toda consulta/plantão pago gera a nota automaticamente, envia o PDF ao
> paciente (e-mail + WhatsApp) e aparece no Admin. As notas que a prefeitura demorar a
> autorizar são reconciliadas sozinhas pelo job a cada 15 min.

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
