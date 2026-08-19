# Auditoria estática Supabase/RLS — 2026-08-19

Escopo: todas as migrations em `supabase/migrations` e todas as Edge Functions em `supabase/functions`. Revisão somente leitura; nenhum código de produto foi alterado. A análise considera o estado final produzido pela ordem das migrations, não apenas vulnerabilidades históricas posteriormente corrigidas.

## Resumo executivo

Foram confirmados 2 achados críticos, 3 altos e 4 médios. O risco dominante é uma policy permissiva tardia em `profiles` que anula as policies restritivas e permite leitura integral de CPF, telefone e nascimento. Também há uma Edge Function de IA que trata autenticação como opcional e aceita o papel `doctor` indicado pelo próprio cliente, e uma RPC pública que ainda retorna a lista de medicamentos apesar de alegar remover PHI.

## Achados priorizados

### C1 — CRÍTICO — leitura irrestrita da tabela `profiles` (PII/LGPD)

**Evidência:** `supabase/migrations/20260426220000_hardened_security_and_rls.sql:24-30` cria `"Users can view all basic profiles" FOR SELECT USING (true)` sem limitar papel. Policies PostgreSQL permissivas são combinadas por OR, portanto as policies de dono/admin não restringem esta. A migration nunca remove essa policy depois. A tabela contém `cpf`, `phone` e `date_of_birth` em `supabase/migrations/20260215211341_41d53d6a-0afd-4b82-9410-26c409a4c4f9.sql:9-20`.

**Impacto:** enumeração em massa de dados pessoais por qualquer role com privilégio de tabela (no Supabase, tipicamente `anon`/`authenticated`, conforme grants do schema aplicado). É necessário confirmar os grants efetivos no banco; para `authenticated`, a exposição é inequívoca se o grant padrão de SELECT permanece.

**Correção:** migration imediata que `DROP POLICY "Users can view all basic profiles"`; manter somente dono, admin e médico relacionado a consulta ativa. Para dados públicos de médico, usar view `security_invoker` com allowlist de colunas. Revogar SELECT de `anon` sobre a tabela base e criar teste negativo para CPF/telefone de outro usuário.

### C2 — CRÍTICO — `ai-assistant` aceita chamadas sem autenticação e papel médico auto-declarado

**Evidência:** `supabase/functions/ai-assistant/index.ts:63-68` autentica de forma explicitamente opcional e continua quando `auth` é nulo. Em `:75-84` existem instruções privilegiadas de médico e em `:116-118` o papel vem diretamente do JSON do cliente, sem consulta a `user_roles`. `config.toml:6-19` reconhece que o gateway/anon key não é autorização real.

**Impacto:** qualquer cliente com anon key pode consumir IA paga e se apresentar como médico, submetendo PHI ao provedor externo sem uma identidade/auditoria confiável. O rate limit usa IP controlado por `x-forwarded-for` (`:67`) e falha aberto se o banco falhar (`:11-20`).

**Correção:** exigir `getCaller(req)` para todas as modalidades exceto uma função de triagem pública separada; derivar role exclusivamente de `user_roles`; negar tarefas clínicas a não-médicos; usar IP fornecido apenas pelo proxy confiável; rate limit atômico e fail-closed; registrar base legal/consentimento e minimizar/redigir PHI antes de chamar o LLM.

### A1 — ALTO — RPC pública de validação ainda devolve medicamentos (PHI)

**Evidência:** `supabase/migrations/20260724140000_document_validation_phi_and_canonical_rpc.sql:3-8` declara que medicamentos/diagnóstico eram PHI e afirma manter apenas contagem, mas a implementação em `:18-25` remove somente `cid`, `reason` e `diagnosis`; a chave `medications` permanece dentro de `details`. A função é `SECURITY DEFINER` e executável por `anon` (`:18-26`, grant histórico mantido para `verify_document_public`).

**Impacto:** posse ou descoberta de código de verificação revela nomes, doses e frequência de medicamentos. Códigos podem aparecer em PDFs, URLs, suporte ou logs.

**Correção:** construir JSON por allowlist (nunca blacklist), retornando no máximo tipo, emitente, datas, validade e `medication_count`; rotacionar/revogar códigos potencialmente expostos; adicionar teste que falhe se qualquer chave clínica surgir na resposta anônima.

### A2 — ALTO — feed iCal usa bearer token longo em URL e expõe agenda nominal

**Evidência:** `supabase/config.toml:46-48` desabilita JWT; `supabase/functions/doctor-ical-feed/index.ts:31-40` autentica apenas por `ical_token`; `:48-59` busca todas as consultas e nomes de pacientes, incorporados ao feed em `:81`. O token em query string tende a chegar a histórico, logs e ferramentas de observabilidade.

**Impacto:** vazamento do token dá acesso persistente à agenda e associação paciente-médico; não há expiração, escopo temporal ou revogação automática visível.

**Correção:** usar token aleatório de alta entropia armazenado apenas como hash, com expiração/rotação e versão; evitar nomes completos (iniciais ou “Paciente”); limitar janela temporal; garantir redaction de query strings nos logs e fornecer revogação no painel.

### A3 — ALTO — `guest-consultation` devolve registros completos com token de URL

**Evidência:** `supabase/functions/guest-consultation/index.ts:17-20` usa service role; `:41-46` faz `appointments.select("*")`; `:55-66` faz `guest_patients.select("*")` e remove apenas CPF; `:86-88` retorna ambos integralmente. A posse de um único `access_token` contorna RLS e pode revelar telefone, e-mail, IDs internos, motivo/status e campos futuros adicionados às tabelas.

**Impacto:** exposição excessiva de PII/PHI e risco crescente por “schema drift”: toda coluna futura passa automaticamente à API.

**Correção:** substituir ambos `select("*")` por allowlist mínima e DTO explícito; não retornar o próprio token; hash/expirar/rotacionar tokens; limitar tentativas atomicamente e registrar eventos sem token; testar resposta contra uma lista proibida de campos.

### M1 — MÉDIO — verificação pública aceita múltiplos identificadores previsíveis

**Evidência:** `supabase/migrations/20260724140000_document_validation_phi_and_canonical_rpc.sql:28-46` permite localizar assinatura por `verification_code`, `related_record_id` ou `id` UUID e retorna nome do paciente, médico, hash e metadados a `anon` (`:48`).

**Impacto:** IDs internos vazados em outros fluxos viram chaves de consulta pública; amplia a superfície de IDOR/oráculo.

**Correção:** aceitar apenas código público dedicado, aleatório e rate-limited; nunca aceitar PK/FK internas; considerar resposta de autenticidade sem nome completo do paciente.

### M2 — MÉDIO — validação de voucher permite enumeração e metadados contratuais

**Evidência:** `supabase/functions/validate-voucher/index.ts:15-31` aceita código e consulta com service role sem autenticação em código; `:63-75` retorna dados do contrato/branding. O gateway padrão pode ser satisfeito pela anon key pública, conforme `config.toml:6-9`.

**Impacto:** brute force de vouchers e descoberta de existência, vigência, saldo e vínculo empresarial; facilita fraude e inteligência comercial.

**Correção:** rate limit atômico por IP/device, resposta indistinguível para inválido/expirado/esgotado, código com entropia suficiente, retorno mínimo e consumo atômico apenas no checkout autenticado.

### M3 — MÉDIO — dados pessoais hardcoded no histórico de migrations

**Evidência:** migrations `20260228190258...sql:1`, `20260228190616...sql:1`, `20260228190703...sql:1`, `20260228190751...sql:1` e `20260228190827...sql:1` contêm UUID, CPF e telefone em comandos UPDATE.

**Impacto:** se forem dados reais, ficam permanentemente no histórico Git, cópias locais e CI; mesmo dados de teste treinam práticas inseguras e podem contaminar produção.

**Correção:** confirmar origem; se reais, tratar como incidente LGPD, remover do histórico com coordenação e rotacionar dados relacionados; mover fixtures sintéticas para seed de ambiente local e impedir execução em produção.

### M4 — MÉDIO — privilégios de funções não são fechados por padrão

**Evidência:** várias migrations concedem `EXECUTE` explicitamente, mas muitas funções `SECURITY DEFINER` históricas não fazem `REVOKE ALL ... FROM PUBLIC` individual. `20260719000000_security_hardening_critical.sql:116-127` corrige `search_path` globalmente, porém não revoga EXECUTE padrão. Exemplos de grants deliberados: `20260616172132...sql:236,274`.

**Impacto:** funções novas/antigas podem permanecer executáveis por `PUBLIC` por padrão, inclusive quando os autores supõem que apenas triggers/service role as chamam. O impacto depende da lógica interna de cada função.

**Correção:** `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`; inventariar `pg_proc.proacl`, revogar em massa e conceder nominalmente a `anon`, `authenticated` ou `service_role`; CI deve reprovar `SECURITY DEFINER` sem `SET search_path`, sem checagem de autorização quando RPC e sem revoke/grant explícito.

## Controles positivos observados

- Todas as tabelas públicas criadas nas migrations têm RLS habilitada em algum ponto; a migration `20260426220000...sql:6-14` também habilita RLS em todas as tabelas existentes.
- `20260719000000_security_hardening_critical.sql:116-127` fixa `search_path` em funções `SECURITY DEFINER` existentes.
- Hardening recente removeu auto-promoção por metadata, IDOR financeiro e enumeração anônima de CPF (`20260719000000...sql:11-114`).
- Várias Edge Functions com service role usam `getCaller`, `isInternalOrService`, assinatura de webhook ou checagem de ownership; `send-prescription/index.ts:64-89` é um bom exemplo de gate de ownership.

## Plano de correção

1. **Hotfix (mesmo dia):** remover a policy permissiva de `profiles`; corrigir `verify_document_public` por allowlist; exigir autenticação/role real em `ai-assistant`; considerar desligar temporariamente essas superfícies até deploy.
2. **Curto prazo (48 h):** minimizar respostas de `guest-consultation` e iCal, rotacionar tokens e revisar logs; fechar enumeração de voucher; auditar acessos recentes a `profiles` e RPCs públicas.
3. **Uma semana:** baseline de grants/default privileges; inventário automático de policies permissivas, funções definer e Edge Functions com service role; testes anon/auth cross-tenant no CI.
4. **Governança:** DLP para CPF/telefone em migrations, threat model dos fluxos PHI e registro de operador/base legal/consentimento para chamadas de IA.

## Verificações recomendadas no banco (somente leitura)

- Consultar `pg_policies` para confirmar a policy `Users can view all basic profiles` e os papéis aplicáveis.
- Consultar `information_schema.role_table_grants` para `profiles`, `document_verifications`, `digital_signatures` e tabelas clínicas.
- Consultar `pg_proc`/`aclexplode(proacl)` para listar toda função `prosecdef=true` executável por `PUBLIC`, `anon` ou `authenticated`.
- Executar testes com JWTs de dois pacientes, um médico sem relação, anon key e sem credencial, garantindo negação cross-tenant e ausência de campos PHI.
