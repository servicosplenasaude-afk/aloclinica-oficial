# Backup e recuperação de desastre

## Escopo e metas

- RPO alvo: 24 horas para exportação operacional; definir RPO menor via PITR do provedor para dados clínicos e financeiros.
- RTO alvo inicial: 4 horas após disponibilização de um projeto Supabase de recuperação.
- A função `daily-backup` é uma exportação operacional paginada, privada, com manifest e SHA-256 por arquivo. Ela não substitui backup offsite nem PITR porque usa Storage no mesmo projeto.

## Controles obrigatórios

1. Manter PITR/backups gerenciados habilitados no projeto de produção e confirmar a retenção no painel do provedor.
2. Copiar snapshots para uma conta/provedor offsite com criptografia, retenção imutável e acesso separado da conta de produção.
3. Alertar quando não existir `daily_backup_run` concluído nas últimas 26 horas ou quando houver execução `failed`.
4. Executar restauração trimestral em projeto isolado. Nunca restaurar por cima de produção durante um ensaio.
5. Registrar data, responsável, snapshot, duração, contagens, checksums e resultado do ensaio.

## Reconciliação segura de migrations

Esta verificação é somente leitura e nunca deve usar `migration repair` automaticamente:

```bash
supabase migration list --linked > migration-list.txt
node scripts/verify-migration-reconciliation.mjs migration-list.txt
```

Saída divergente bloqueia deploy. Investigue o histórico antes de qualquer repair; repair requer aprovação humana, backup confirmado e registro de mudança.

## Ensaio de restore

1. Criar projeto Supabase temporário e isolado, sem integrações/webhooks de produção.
2. Restaurar o dump/PITR fornecido pelo provedor.
3. Aplicar somente migrations locais que a reconciliação identificar como pendentes e que tenham sido revisadas.
4. Validar RLS com usuários distintos e executar consultas de contagem sem exportar PHI para logs.
5. Validar checksums do manifest da exportação operacional antes de usar arquivos.
6. Destruir o ambiente temporário conforme a política aprovada e guardar apenas evidências sem dados pessoais.

## Limitações conhecidas

- JSON não preserva sozinho todos os objetos PostgreSQL, constraints, roles e extensões; recuperação integral depende de PITR ou `pg_dump` validado.
- A exportação REST pagina com ordenação determinística, mas não representa uma transação única entre tabelas; dados alterados durante a execução podem ficar temporalmente inconsistentes. PITR é o mecanismo canônico de recuperação consistente.
- O repositório não consegue provar configuração, retenção ou restauração do provedor sem credencial autorizada e um ensaio externo.
