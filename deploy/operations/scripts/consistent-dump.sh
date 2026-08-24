#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

STACK_DIR="${STACK_DIR:-/opt/aloclinica-operations}"
CONFIG_FILE="${DATABASE_BACKUP_CONFIG:-$STACK_DIR/backup-databases.conf}"
DUMP_ROOT="${DATABASE_DUMP_ROOT:-/opt/aloclinica-backup-staging}"
RUN_ID="${BACKUP_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
RUN_DIR="$DUMP_ROOT/$RUN_ID"

[[ "$DUMP_ROOT" == /opt/aloclinica-backup-staging ]] || { echo "unexpected dump root" >&2; exit 2; }
install -d -m 0700 "$RUN_DIR"

if [[ ! -s "$CONFIG_FILE" ]] || ! grep -qvE '^[[:space:]]*(#|$)' "$CONFIG_FILE"; then
  echo "no application-consistent database dumps configured"
  exit 0
fi

count=0
while IFS='|' read -r container db_user database extra; do
  [[ "$container" =~ ^[a-zA-Z0-9_.-]+$ ]] || { echo "invalid container name" >&2; exit 2; }
  [[ "$db_user" =~ ^[a-zA-Z0-9_.-]+$ ]] || { echo "invalid database user" >&2; exit 2; }
  [[ "$database" =~ ^[a-zA-Z0-9_.-]+$ ]] || { echo "invalid database name" >&2; exit 2; }
  [[ -z "${extra:-}" ]] || { echo "invalid database backup entry" >&2; exit 2; }

  docker inspect "$container" >/dev/null 2>&1 || { echo "container not found: $container" >&2; exit 1; }
  [[ "$(docker inspect --format '{{.State.Running}}' "$container")" == true ]] || { echo "container is not running: $container" >&2; exit 1; }

  output="$RUN_DIR/${container}-${database}.dump"
  docker exec "$container" pg_dump --format=custom --no-owner --no-privileges --username "$db_user" "$database" >"$output"
  [[ -s "$output" ]] || { echo "empty database dump: $container/$database" >&2; exit 1; }
  docker exec -i "$container" pg_restore --list <"$output" >/dev/null
  (cd "$RUN_DIR" && sha256sum "$(basename "$output")" >"$(basename "$output").sha256")
  count=$((count + 1))
  echo "validated database dump: $container/$database"
done < <(grep -vE '^[[:space:]]*(#|$)' "$CONFIG_FILE")

printf '{"run_id":"%s","created_at":"%s","database_count":%d}\n' \
  "$RUN_ID" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$count" >"$RUN_DIR/manifest.json"
echo "$RUN_DIR"
