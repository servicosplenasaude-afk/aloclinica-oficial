# AloClínica — stack operacional da VPS

Esta stack adiciona observabilidade, detecção de abuso, aviso de atualizações e
backup externo sem alterar MiroTalk, Coturn, CompreFace ou Evolution API.

## Componentes

- **Uptime Kuma:** painel local em `127.0.0.1:3001`.
- **Grafana Alloy:** envia métricas e logs para uma stack Grafana externa.
- **CrowdSec:** coleta logs em modo detect-only até o bouncer ser validado.
- **DIUN:** avisa sobre novas imagens; não atualiza automaticamente.
- **Restic:** backup criptografado para Cloudflare R2/S3 compatível.
- **Docker socket proxy:** oferece somente operações de leitura para Alloy e DIUN.
- **Host readiness:** audita diariamente Docker, disco, memória, NTP, firewall,
  SSH e atualizações de segurança sem modificar a VPS.

## Instalação

```bash
sudo ./scripts/install.sh --prepare
sudoedit /opt/aloclinica-operations/.env
sudo /opt/aloclinica-operations/scripts/install.sh --install-core
```

Depois de preencher Grafana, webhook e R2:

```bash
sudo /opt/aloclinica-operations/scripts/install.sh --install-all
```

Nenhuma porta administrativa é aberta publicamente. Primeiro acesso:

```bash
ssh -L 3001:127.0.0.1:3001 usuario@servidor
```

## Monitores mínimos

- `https://aloclinica.com.br/health` e `/status`
- MiroTalk, CompreFace e Evolution API
- DNS dos domínios
- TCP 3478 e 5349 do Coturn
- push monitor acionado após cada backup

Use dois canais de alerta independentes.

Como o Uptime Kuma roda na mesma VPS, mantenha também um monitor externo: uma
falha total do servidor derrubaria simultaneamente o serviço e esse painel local.
O workflow `Production Readiness` executa esse monitor externo a cada 15 minutos,
guarda a evidência por 30 dias, abre um incidente no GitHub quando um serviço
crítico falha e fecha o incidente automaticamente após a recuperação.

## Backup e restauração

```bash
sudo /opt/aloclinica-operations/scripts/backup.sh
sudo RESTORE_DIR=/opt/aloclinica-operations/restore-drill /opt/aloclinica-operations/scripts/restore-drill.sh
```

Nunca restaure diretamente sobre produção; valide em destino isolado.
O snapshot de volumes Docker em execução é uma cópia de recuperação de desastre,
não substitui exportações consistentes de bancos internos. Antes do go-live,
configure `backup-databases.conf` com `container|usuario|banco` para cada
PostgreSQL que permaneça na VPS. Antes de cada snapshot, o processo gera um dump
custom, valida seu catálogo com `pg_restore`, calcula SHA-256 e o inclui no Restic.
Se um banco configurado falhar, o backup inteiro falha em vez de publicar uma
evidência enganosa de sucesso.

## Saúde e logs do host

Execute uma auditoria imediata com:

```bash
sudo /opt/aloclinica-operations/scripts/host-readiness.sh
```

O timer diário envia o resultado ao journal, consultável com
`journalctl -u aloclinica-host-readiness`. O arquivo
`docker-daemon.example.json` contém uma política recomendada de rotação de logs,
mas não é aplicado automaticamente porque o VPS pode possuir opções Docker já
configuradas; mescle e valide no sandbox antes de reiniciar o daemon.

## CrowdSec

Antes de habilitar um bouncer no Traefik, confirme trusted proxies e o IP real da
Cloudflare. Uma configuração incorreta pode bloquear pacientes. Valide primeiro
no sandbox e só então habilite bloqueio em produção.

## Atualizações

DIUN envia avisos. O fluxo é sandbox, backup, versão fixada, produção e rollback.
Não use atualização automática cega em produção.

## Deploy automatizado

O workflow `Deploy VPS Operations` é manual, usa o environment protegido
`production`, valida Compose e scripts antes de acessar o servidor e executa
rollback para o release anterior se a verificação pós-instalação falhar.

Uma única vez, como root no VPS, instale o executor restrito informando o usuário
SSH usado pelo GitHub:

```bash
sudo ./scripts/install-deploy-runner.sh usuario-deploy
```

Cadastre estes secrets no GitHub sem colocá-los no repositório:

- `VPS_OPERATIONS_HOST` e `VPS_OPERATIONS_USER`
- `VPS_OPERATIONS_SSH_KEY` e `VPS_OPERATIONS_HOST_KEY`
- `VPS_OPERATIONS_ENV_B64` (conteúdo do `.env` codificado em base64)
- `VPS_RESTIC_PASSWORD_B64` (senha Restic codificada em base64)

O instalador cria e valida uma regra `sudoers` limitada ao executor de operações;
não conceda `sudo` genérico ao usuário de deploy.
