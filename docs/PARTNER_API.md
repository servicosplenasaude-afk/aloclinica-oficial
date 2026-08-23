# API de parceiros AloClínica

Base de produção:

`https://pwxvvimdtmvziynbspgx.supabase.co/functions/v1/public-api`

Contrato OpenAPI: `GET /v1/openapi.json`. Nunca coloque uma chave de parceiro no frontend, aplicativo distribuído ou repositório; use-a apenas no servidor da integração.

## Autenticação e ambientes

Envie `Authorization: ApiKey <prefixo>.<segredo>`. Chaves de sandbox e produção são independentes, têm escopos explícitos, limite por minuto e podem ser revogadas. O segredo completo é mostrado somente na emissão.

A emissão e a revogação são feitas pela função administrativa `admin-api-keys`, com sessão de administrador emitida há no máximo dez minutos. A resposta de criação contém `api_key` uma única vez; listagens posteriores mostram apenas o prefixo.

Escopos da v1:

- `catalog:read`: especialidades e diretório público de médicos.
- `availability:read`: horários livres, em `America/Sao_Paulo`.
- `appointments:read`: agendamentos pertencentes à credencial.
- `appointments:write`: cria agendamento somente para o paciente proprietário da credencial.

## Endpoints

- `GET /v1/me`
- `GET /v1/specialties?search=cardio&limit=50`
- `GET /v1/doctors?specialty=Cardiologia&search=ana&limit=20`
- `GET /v1/availability?doctor_id=<uuid>&from=2026-08-24&to=2026-08-31`
- `GET /v1/appointments?limit=50`
- `POST /v1/appointments`

Exemplo de agendamento:

```http
POST /v1/appointments HTTP/1.1
Authorization: ApiKey abcdef12.SEGREDO
Content-Type: application/json
Idempotency-Key: pedido-erp-000123

{"doctor_id":"00000000-0000-4000-8000-000000000000","scheduled_at":"2026-08-30T14:00:00-03:00"}
```

Repetir a mesma requisição com a mesma `Idempotency-Key` devolve o mesmo agendamento. Reutilizar a chave com outro conteúdo retorna `409`. O agendamento nasce com pagamento pendente; a API não aceita preço enviado pelo parceiro.

## Limites da v1

A v1 não expõe prontuários, receitas, laudos, documentos, CPF, telefone ou e-mail. Também não permite que uma empresa agende para um paciente arbitrário: esse fluxo exige vínculo empresarial e consentimento verificável, previstos para uma versão posterior.
