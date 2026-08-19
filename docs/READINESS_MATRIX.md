# Matriz de prontidão para produção

Fonte canônica para a decisão de go-live. Revisada em **2026-08-19** contra o
conteúdo do repositório; estados de serviços externos precisam de evidência nova
da execução indicada e não são inferidos a partir de relatos históricos.

## Inventário verificável no repositório

| Item | Valor | Como reproduzir |
|---|---:|---|
| Edge Functions implantáveis | **87** | `(Get-ChildItem supabase/functions -Directory \| ? Name -ne '_shared' \| ? { Test-Path "$($_.FullName)/index.ts" }).Count` |
| Biblioteca compartilhada de functions | **1** (`_shared`, não implantável) | `Test-Path supabase/functions/_shared` |
| Functions com exceção explícita de JWT | **18** | `rg '^\[functions\.' supabase/config.toml` (revisar cada bloco e sua autenticação alternativa) |
| Migrations versionadas | **306** | `(Get-ChildItem supabase/migrations -File).Count` |
| Workflows GitHub Actions | **9** | `(Get-ChildItem .github/workflows -File).Count` |
| Scripts de auditoria/saúde/carga | **3** | `npm run audit:production`, `npm run health:production`, `npm run load:baseline` |

O inventário mede o checkout, não o que está efetivamente implantado no Supabase.
Para detectar drift, compare a lista local com a API/dashboard do projeto antes de
cada release.

## Critério objetivo de estado

- **Verde:** comando/evidência passou na release candidata e o link do run foi anexado.
- **Amarelo:** implementação existe, mas depende de validação externa ou manual recente.
- **Vermelho:** condição bloqueante falhou ou ainda não tem evidência.
- **N/A:** item formalmente dispensado, com responsável e justificativa registrados.

Nenhum item abaixo deve ser marcado apenas porque apareceu como concluído em um
documento antigo.

## Gates de go-live

| Gate | Estado no repositório | Evidência exigida para ficar verde | Responsável | Bloqueia? |
|---|---|---|---|---|
| Build, lint e testes | Amarelo | Run do `test.yml` no SHA candidato com todos os jobs verdes | Engenharia | Sim |
| Auditoria estática de produção | Amarelo | `npm run audit:production` sem falhas no SHA candidato | Engenharia | Sim |
| Saúde pública | Amarelo | `npm run health:production -- --json` após deploy, saída anexada | Operações | Sim |
| Deploy atômico frontend/backend | **Vermelho** | Remover/justificar `continue-on-error: true` do job `deploy-supabase` em `.github/workflows/deploy.yml`; falha de functions deve falhar a release | Engenharia | **Sim** |
| Paridade das 87 Edge Functions | Amarelo | Lista remota comparada aos 87 slugs locais; diferenças zeradas ou justificadas | Engenharia | Sim |
| Exceções de JWT | Amarelo | Revisão das 18 entradas de `config.toml`, comprovando assinatura de webhook, segredo interno ou endpoint público seguro | Segurança | Sim |
| Migrations/RLS sem drift | Amarelo | `scripts/prod_readiness.sql`, Security Advisor e `check-go-live.yml` executados no banco alvo | DBA/Segurança | Sim |
| Segredos de produção | Amarelo | Checklist de existência/rotação nos cofres; nunca registrar valores | Operações | Sim |
| Pagamento PIX e cartão | Amarelo | Transações reais de baixo valor, webhook aprovado, estorno e conciliação registrados | Financeiro/QA | Sim |
| Assinatura clínica válida | Amarelo | Receita/atestado de teste validado com o provedor escolhido (Memed ou VIDAAS) | Clínico/Compliance | Sim |
| Teleconsulta ponta a ponta | Amarelo | Médico + paciente: agenda, pagamento, vídeo, prontuário e documento; IDs de teste anexados | QA/Clínico | Sim |
| Vídeo e contingência TURN | Amarelo | Teste em duas redes, incluindo caminho TURN; registrar taxa de sucesso | Operações | Sim |
| WhatsApp | Amarelo | Instância conectada e mensagem de teste entregue; ou N/A formal se e-mail for o canal de lançamento | Operações | Não, se N/A aprovado |
| E-mail e domínio | Amarelo | SPF/DKIM/DMARC válidos e mensagens de auth/transacionais entregues | Operações | Sim |
| Observabilidade e plantão | Amarelo | Evento de teste no Sentry, alertas, contato on-call e canal de incidente confirmados | Operações | Sim |
| Backup e restauração | Amarelo | Backup recente e restauração ensaiada, com data/RTO/RPO | DBA | Sim |
| Rollback | Amarelo | `rollback-production.yml` ensaiado em staging e health check verde | Engenharia | Sim |
| Capacidade | Amarelo | Baseline HTTP e teste de consultas concorrentes conforme `PRODUCTION_READINESS.md` | Engenharia | Sim |
| Jurídico/CFM/LGPD/NFS-e | Amarelo | Aprovação dos responsáveis e evidências descritas em `CONFORMIDADE_CFM.md` e `GO-LIVE.md` | Compliance/Contábil | Sim |

## Registro mínimo da decisão

Antes de divulgar, registre em uma issue/release: SHA, ambiente, data/hora, links
dos workflows, saídas de auditoria/saúde, evidências dos testes financeiro e
clínico, lista de exceções N/A, aprovadores e plano de rollback. Go-live exige
todos os gates bloqueantes verdes; “implementado” não equivale a “validado”.

## Pendências consolidadas

As pendências históricas permanecem como insumo em `GO-LIVE.md` e
`CORRECOES-PENDENTES.md`, mas precisam ser reconfirmadas. Na data desta revisão,
o repositório sozinho **não comprova** rotação de credenciais, estado remoto do
Supabase/VPS, pareamento do WhatsApp, credenciais reais de assinatura, testes de
pagamento, restauração de backup ou teste ponta a ponta.
