#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

STACK_DIR="${STACK_DIR:-/opt/aloclinica-operations}"
cd "$STACK_DIR"

if [[ ! -f .env ]]; then echo "operations .env missing" >&2; exit 2; fi
set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ ! -s "${RESTIC_PASSWORD_HOST_FILE:-}" ]]; then echo "restic password file missing" >&2; exit 2; fi
for name in RESTIC_REPOSITORY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY; do
  [[ -n "${!name:-}" ]] || { echo "required backup setting missing: $name" >&2; exit 2; }
done

restic() { docker compose --env-file .env -f compose.yml --profile tools run --rm -T restic "$@"; }
export BACKUP_RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
"$STACK_DIR/scripts/consistent-dump.sh"
if ! restic snapshots --compact >/dev/null 2>&1; then
  restic init
fi

restic backup \
  /backup/etc-easypanel \
  /backup/etc-traefik \
  /backup/opt-aloclinica \
  /backup/docker-volumes \
  /backup/database-dumps \
  --host aloclinica-production \
  --tag vps-operations

restic forget \
  --host aloclinica-production \
  --tag vps-operations \
  --keep-daily "${RESTIC_KEEP_DAILY:-7}" \
  --keep-weekly "${RESTIC_KEEP_WEEKLY:-5}" \
  --keep-monthly "${RESTIC_KEEP_MONTHLY:-12}" \
  --prune

restic check --read-data-subset=5%

DUMP_ROOT=/opt/aloclinica-backup-staging
[[ "$DUMP_ROOT" == /opt/aloclinica-backup-staging ]] || exit 2
find "$DUMP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf -- {} +
