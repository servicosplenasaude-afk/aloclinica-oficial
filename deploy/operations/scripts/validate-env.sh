#!/usr/bin/env bash
set -Eeuo pipefail
STACK_DIR="${STACK_DIR:-/opt/aloclinica-operations}"
cd "$STACK_DIR"
[[ -f .env ]] || { echo ".env missing" >&2; exit 2; }
set -a
source .env
set +a

required=(OPERATIONS_TIMEZONE UPTIME_KUMA_IMAGE ALLOY_IMAGE CROWDSEC_IMAGE DIUN_IMAGE SOCKET_PROXY_IMAGE RESTIC_IMAGE)
if [[ "${1:-}" == "--all" ]]; then
  required+=(GRAFANA_LOKI_URL GRAFANA_LOKI_USERNAME GRAFANA_LOKI_PASSWORD GRAFANA_PROMETHEUS_URL GRAFANA_PROMETHEUS_USERNAME GRAFANA_PROMETHEUS_PASSWORD DIUN_WEBHOOK_ENDPOINT RESTIC_REPOSITORY RESTIC_PASSWORD_HOST_FILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY)
fi
failed=0
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then echo "missing: $name" >&2; failed=1; fi
done
[[ "$failed" -eq 0 ]] || exit 2
[[ -z "${RESTIC_PASSWORD_HOST_FILE:-}" || -s "$RESTIC_PASSWORD_HOST_FILE" ]] || { echo "restic password file is empty or missing" >&2; exit 2; }
docker compose --env-file .env -f compose.yml --profile telemetry --profile updates --profile tools config --quiet
echo "operations configuration valid"
