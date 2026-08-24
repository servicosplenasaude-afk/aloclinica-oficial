#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

STACK_DIR="${STACK_DIR:-/opt/aloclinica-operations}"
RESTORE_DIR="${RESTORE_DIR:-$STACK_DIR/restore-drill}"
cd "$STACK_DIR"

[[ -f .env ]] || { echo "operations .env missing" >&2; exit 2; }
set -a
# shellcheck disable=SC1091
source .env
set +a

mkdir -p "$RESTORE_DIR"
if [[ -n "$(find "$RESTORE_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
  echo "restore target must be empty: $RESTORE_DIR" >&2
  exit 2
fi

docker compose --env-file .env -f compose.yml --profile tools run --rm -T \
  -v "$RESTORE_DIR:/restore" restic restore latest --target /restore \
  --include /backup/etc-traefik --include /backup/database-dumps

test -n "$(find "$RESTORE_DIR" -type f -print -quit)" || { echo "restore produced no files" >&2; exit 1; }
while IFS= read -r checksum; do
  (cd "$(dirname "$checksum")" && sha256sum --check "$(basename "$checksum")")
done < <(find "$RESTORE_DIR/backup/database-dumps" -type f -name '*.sha256' -print 2>/dev/null || true)
echo "restore drill completed at $RESTORE_DIR"
