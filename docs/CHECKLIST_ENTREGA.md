# Checklist de Entrega — AloClínica (produção)

> Registro histórico de entrega. Para go-live, revalide cada conclusão usando a
> matriz objetiva em [`READINESS_MATRIX.md`](READINESS_MATRIX.md); o repositório
> não comprova sozinho deploy, secrets ou estado da infraestrutura.

## ✅ O que foi corrigido / adicionado

### Segurança (CRÍTICO)
- [x] **Auto-promoção a admin no cadastro** bloqueada (`handle_new_user` não confia no `role` do cliente)
- [x] **IDOR financeiro** (`fn_get_cartao_summary`) — exige dono/admin
- [x] **Cadastro público de suporte** removido (acesso a PII)
- [x] **Oráculo de enumeração de CPF** (`cpf_in_use`) revogado de `anon`
- [x] `search_path` fixo em todas as funções `SECURITY DEFINER`
- [x] **Assinatura falsa "ICP-Brasil"** → rótulo honesto (assinatura real via Memed, pendente chaves)
- [x] **IDOR nos geradores de PDF** — exige médico dono/serviço
- [x] **Endpoints internos** (backup/cron) fail-closed
- [x] Chaves KYC (CompreFace) → variáveis de ambiente
- [x] `register-signature` — identidade do médico derivada do JWT (anti-spoofing)

### Pagamento
- [x] **Preço autoritativo no servidor** (`doctor_profiles.consultation_price` − cupom validado no servidor) — fecha o subfaturamento ("pagar R$1")
- [x] Cupom validado no servidor; desconto de retorno removido (só cupom)

### Conformidade CFM (Res. 2.314/2022)
- [x] Documentos (receita/atestado): endereço médico+paciente, local do atendimento, data/hora, marcador "telemedicina" (Art 13 a,b,c,e)
- [x] TCLE v2.0: transmissão de dados, compartilhamento + direito de negar, direito ao presencial (Art 15, 15§ún, 19)
- [x] Dados da PJ + Responsável Técnica exibidos (Art 17)
- [x] Imutabilidade de registros clínicos + política de retenção 20 anos (Art 3)

### Produto / escopo
- [x] Removidas features Oftalmologia, Laudos e Cartão de Benefícios (foco teleconsulta)
- [x] Build verde em todas as etapas; correção do `.dockerignore` (build multi-stage)

### Documentação
- [x] `README.md` (stack, arquitetura, setup, env, deploy)
- [x] `docs/CONFORMIDADE_CFM.md`, `docs/APLICAR_NO_SUPABASE.sql`

## 🚀 Deploy — passo a passo

1. **Supabase (SQL):** SQL Editor → colar `docs/APLICAR_NO_SUPABASE.sql` → Run (idempotente).
2. **Supabase (Edge Functions):** `supabase functions deploy` (requer Access Token `sbp_`) + `supabase secrets set ...`.
3. **VPS (frontend):** no terminal, `docker build` do repo + `docker run` + Caddy (HTTPS). DNS `A` → IP da VPS (já apontado).
4. **Verificar:** `https://aloclinica.com.br` abre o app.

## 🧩 Pendências que dependem de você

| # | Item | Por quê |
|---|---|---|
| 1 | **Chaves de produção Memed** | Assinatura ICP-Brasil real da receita (CFM Art 13 d) |
| 2 | **Confirmar paridade das 87 Edge Functions locais com o Supabase** | O deploy requer `SUPABASE_ACCESS_TOKEN`; anexar a lista remota e o run da release |
| 3 | **Finalizar inscrição CRM-PJ** (Roraima) | CFM Art 17 |
| 4 | **DPA com o Supabase** | CFM Art 3 §4 / LGPD (responsabilidade compartilhada) |
| 5 | **Rotacionar credenciais** expostas durante o setup | GitHub token, senha VPS, chaves Supabase/Hostinger |
| 6 | **Endereço profissional de cada médico** | Preencher `doctor_profiles.professional_address` |
| 7 | Termo de Uso / Política de Privacidade revisados por advogado | Jurídico |

## 🔜 Melhorias recomendadas (próximas etapas de qualidade)
- Documentos clínicos em Storage com URL assinada (privada) em vez de pública
- Rate limiting fail-closed nos endpoints de IA
- Segurança de tipos nos caminhos de PHI (reduzir `any`) + React Query nos fluxos quentes
- Testes E2E automatizados (login → agendar → consulta → receita) no CI
