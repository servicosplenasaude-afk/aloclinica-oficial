#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${TARGET_DIR:-/opt/aloclinica-operations}"
MODE="${1:---prepare}"

[[ "$(id -u)" -eq 0 ]] || { echo "run as root" >&2; exit 2; }
command -v docker >/dev/null || { echo "docker is required" >&2; exit 2; }
docker compose version >/dev/null || { echo "docker compose plugin is required" >&2; exit 2; }

install -d -m 0700 "$TARGET_DIR" "$TARGET_DIR/secrets"
SOURCE_REAL="$(cd "$SOURCE_DIR" && pwd -P)"
TARGET_REAL="$(cd "$TARGET_DIR" && pwd -P)"
if [[ "$SOURCE_REAL" != "$TARGET_REAL" ]]; then
  cp -a "$SOURCE_DIR/." "$TARGET_DIR/"
fi
cd "$TARGET_DIR"
[[ -f .env ]] || { cp .env.example .env; chmod 0600 .env; }
[[ -f backup-databases.conf ]] || { cp backup-databases.conf.example backup-databases.conf; chmod 0600 backup-databases.conf; }
if [[ ! -s secrets/restic-password ]]; then
  command -v openssl >/dev/null || { echo "openssl is required" >&2; exit 2; }
  openssl rand -base64 48 > secrets/restic-password
  chmod 0600 secrets/restic-password
fi
chmod 0750 scripts/*.sh
docker compose --env-file .env -f compose.yml config --quiet

case "$MODE" in
  --prepare) echo "prepared at $TARGET_DIR; fill .env and run --install-core or --install-all" ;;
  --install-core) docker compose --env-file .env -f compose.yml up -d docker-socket-proxy uptime-kuma crowdsec ;;
  --install-all)
    ./scripts/validate-env.sh --all
    docker compose --env-file .env -f compose.yml --profile telemetry --profile updates up -d
    install -m 0644 systemd/aloclinica-backup.service /etc/systemd/system/aloclinica-backup.service
    install -m 0644 systemd/aloclinica-backup.timer /etc/systemd/system/aloclinica-backup.timer
    install -m 0644 systemd/aloclinica-host-readiness.service /etc/systemd/system/aloclinica-host-readiness.service
    install -m 0644 systemd/aloclinica-host-readiness.timer /etc/systemd/system/aloclinica-host-readiness.timer
    systemctl daemon-reload
    systemctl enable --now aloclinica-backup.timer
    systemctl enable --now aloclinica-host-readiness.timer
    ;;
  *) echo "usage: install.sh [--prepare|--install-core|--install-all]" >&2; exit 2 ;;
esac
