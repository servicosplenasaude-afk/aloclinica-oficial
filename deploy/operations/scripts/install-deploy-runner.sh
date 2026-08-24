#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_USER="${1:?usage: install-deploy-runner.sh <ssh-deploy-user>}"
[[ "$(id -u)" -eq 0 ]] || { echo "run as root" >&2; exit 2; }
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || { echo "invalid deploy user" >&2; exit 2; }
id "$DEPLOY_USER" >/dev/null 2>&1 || { echo "deploy user does not exist" >&2; exit 2; }

install -d -m 0755 /usr/local/libexec
install -o root -g root -m 0755 "$(dirname "$0")/remote-deploy.sh" /usr/local/libexec/aloclinica-operations-deploy

sudoers_file=/etc/sudoers.d/aloclinica-operations-deploy
printf '%s ALL=(root) NOPASSWD: /usr/local/libexec/aloclinica-operations-deploy *\n' "$DEPLOY_USER" >"$sudoers_file"
chmod 0440 "$sudoers_file"
visudo -cf "$sudoers_file"
echo "restricted deploy runner installed for $DEPLOY_USER"
