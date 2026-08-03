# Migração de pagamento: Mercado Pago → PagBank

Construída **ao lado** do Mercado Pago. Nada toca o MP até a virada (Fase 6),
quando o PagBank estiver 100% testado no sandbox. Se algo falhar, o MP continua.

## Status

| Fase | O quê | Status |
|---|---|---|
| 1 | Fundação: criar cobrança PIX + webhook + verificação de conexão | ✅ **feito** (repo) |
| — | **Config: secrets + webhook** (sua parte) | ⏳ **pendente** |
| — | Validar conexão no sandbox (`pagbank-status`) | ⏳ depende da config |
| 2 | Checkout PIX na tela (ligar ao `pagbank-create-payment`) | ⬜ após validar |
| 3 | Cartão (criptografia com chave pública + cobrança) | ⬜ |
| 4 | Split / Connect — repasse ao médico | ⬜ |
| 5 | Assinaturas (recorrência) | ⬜ |
| 6 | Testar tudo no sandbox → **virar a chave** | ⬜ |

## Arquivos já criados (Fase 1)
- `supabase/functions/_shared/pagbank.ts` — base URL (sandbox/prod), token, criar order, validar webhook.
- `supabase/functions/pagbank-create-payment/index.ts` — cria PIX (valor no servidor, dono da consulta).
- `supabase/functions/pagbank-webhook/index.ts` — recebe notificação, valida assinatura, confirma pagamento.
- `supabase/functions/pagbank-status/index.ts` — **diagnóstico** (admin): testa a conexão.
- `src/lib/pagbank.ts` — cliente frontend.
- `supabase/config.toml` — `pagbank-webhook` com `verify_jwt=false`.

## Configuração (sua parte — 3 passos)
1. **Rotacionar** qualquer token que tenha sido exposto (gerar novo no PagBank).
2. **Secrets no Supabase** (Project Settings → Edge Functions → Secrets):
   - `PAGBANK_TOKEN` = token de **sandbox** (depois troca para o de produção na Fase 6)
   - `PAGBANK_ENV` = `sandbox`
3. **Webhook no PagBank** — URL de notificação:
   `https://pwxvvimdtmvziynbspgx.supabase.co/functions/v1/pagbank-webhook`

## Como validar a conexão (assim que configurar)
Logado como **admin**, chamar a função `pagbank-status`. Resposta esperada:
`{ "configured": true, "env": "sandbox", "connection_ok": true, "got_qr": true }`.
Ela cria um PIX de R$ 1,00 de teste (ninguém paga) só para confirmar o token.

## Princípio (importante)
**Não construir as próximas fases às cegas.** Cada fase de pagamento (cartão,
split, assinaturas, virada) só depois de a anterior ser **testada no sandbox** —
código de pagamento não testado num sistema médico é risco. A Fase 1 é o quanto
dá para adiantar com segurança antes de a conexão ser validada.

## Referências
- APIs: https://developer.pagbank.com.br/docs/apis-pagbank
- Criptografia/chave pública (cartão): https://developer.pagbank.com.br/docs/criptografia-e-chave-publica
- Autenticidade do webhook: https://developer.pagbank.com.br/reference/confirmar-autenticidade-da-notificacao
- Connect (split): https://developer.pagbank.com.br/docs/connect-challenge
