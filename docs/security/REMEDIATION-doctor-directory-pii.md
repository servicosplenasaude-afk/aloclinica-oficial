# Remediação — PII de médico exposta a paciente logado (deferido)

**Risco:** a política `"Anon can view doctor public profile names"` na tabela `profiles` aplica-se a *public* (anon + authenticated) e, como RLS é por-linha, expõe a **linha inteira** de médicos aprovados+ativos. O vetor **anônimo já está fechado** (o role `anon` só tem SELECT nas 6 colunas seguras). Mas o `authenticated` tem SELECT de tabela cheia → **qualquer paciente logado lê CPF/telefone/endereço/nascimento/`allergies`/`chronic_conditions` dos MÉDICOS** (não de outros pacientes).

**⚠️ Aplicar com uma CONTA DE MÉDICO de teste** — precisa validar que o diretório (`DoctorSearch`), listas de consulta e chat continuam mostrando o nome do médico.

## Passos

1. View de diretório (só colunas seguras), sem herdar RLS de `profiles`:
```sql
CREATE OR REPLACE VIEW public.v_doctor_directory
WITH (security_invoker = false) AS
  SELECT p.user_id, p.first_name, p.last_name, p.social_name, p.avatar_url
  FROM public.profiles p
  JOIN public.doctor_profiles dp ON dp.user_id = p.user_id
  WHERE COALESCE(dp.is_approved,false) = true AND COALESCE(dp.is_active,false) = true;
GRANT SELECT ON public.v_doctor_directory TO anon, authenticated;
```

2. Migrar TODAS as leituras de nome/avatar de médico feitas em `profiles` para `v_doctor_directory`. Mapear com:
```
grep -rn "from(\"profiles\")" src | (revisar cada uma que busca dados de MÉDICO, não do próprio usuário)
```
   Principais: `DoctorSearch.tsx`, listas de consulta (`AppointmentsList`, `DoctorConsultations`), chat, `getDoctorInfo` em `src/lib/notifications.ts`. As leituras do PRÓPRIO perfil do usuário continuam em `profiles` (policy "Users view own profile").

3. Só depois de migrar todos os consumidores, apertar a política:
```sql
ALTER POLICY "Anon can view doctor public profile names" ON public.profiles
  USING (false);
```
   (Se preferir manter para `anon` — que já é seguro por coluna — troque por uma policy restrita ao role `anon`; o problema é só o `authenticated`.)

## Verificação pós-fix
- `DoctorSearch` lista médicos com nome/avatar (via view). ✅
- Um paciente logado NÃO consegue `select cpf,phone from profiles where user_id=<medico>` (retorna 0 linhas). ✅
- Usuário ainda lê o próprio CPF/telefone (checkout, KYC, editar perfil). ✅
