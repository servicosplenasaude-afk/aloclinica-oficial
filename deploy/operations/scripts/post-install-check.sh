#!/usr/bin/env bash
set -Eeuo pipefail

STACK_DIR="${STACK_DIR:-/opt/aloclinica-operations}"
cd "$STACK_DIR"

compose=(docker compose --env-file .env -f compose.yml --profile telemetry --profile updates)
"${compose[@]}" config --quiet

required=(docker-socket-proxy uptime-kuma alloy crowdsec diun)
failed=0
for service in "${required[@]}"; do
  container_id="$("${compose[@]}" ps -q "$service")"
  if [[ -z "$container_id" ]]; then
    echo "not running: $service" >&2
    failed=1
    continue
  fi
  state="$(docker inspect --format '{{.State.Status}}' "$container_id")"
  if [[ "$state" != "running" ]]; then
    echo "unhealthy state: $service ($state)" >&2
    failed=1
  else
    echo "running: $service"
  fi
done

systemctl is-enabled --quiet aloclinica-backup.timer || { echo "backup timer not enabled" >&2; failed=1; }
systemctl is-active --quiet aloclinica-backup.timer || { echo "backup timer not active" >&2; failed=1; }
systemctl is-enabled --quiet aloclinica-host-readiness.timer || { echo "host readiness timer not enabled" >&2; failed=1; }
systemctl is-active --quiet aloclinica-host-readiness.timer || { echo "host readiness timer not active" >&2; failed=1; }
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3001/ >/dev/null || { echo "uptime-kuma local probe failed" >&2; failed=1; }

[[ "$failed" -eq 0 ]] || exit 1
echo "operations post-install checks passed"
