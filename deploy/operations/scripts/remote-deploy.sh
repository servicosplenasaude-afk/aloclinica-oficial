#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

RELEASE_ARCHIVE="${1:?release archive is required}"
ENV_FILE="${2:?environment file is required}"
RESTIC_PASSWORD_FILE="${3:?restic password file is required}"
TARGET_DIR="${TARGET_DIR:-/opt/aloclinica-operations}"
RELEASE_ID="${RELEASE_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
RELEASE_DIR="/opt/aloclinica-operations-releases/$RELEASE_ID"

[[ "$(id -u)" -eq 0 ]] || { echo "run as root" >&2; exit 2; }
install -d -m 0700 "$RELEASE_DIR" "$RELEASE_DIR/secrets"
tar -xzf "$RELEASE_ARCHIVE" -C "$RELEASE_DIR"
install -m 0600 "$ENV_FILE" "$RELEASE_DIR/.env"
install -m 0600 "$RESTIC_PASSWORD_FILE" "$RELEASE_DIR/secrets/restic-password"

previous=""
if [[ -L "$TARGET_DIR" ]]; then previous="$(readlink -f "$TARGET_DIR")"; fi
ln -sfn "$RELEASE_DIR" "${TARGET_DIR}.next"
mv -Tf "${TARGET_DIR}.next" "$TARGET_DIR"

rollback() {
  echo "deployment failed; rolling back" >&2
  if [[ -n "$previous" && -d "$previous" ]]; then
    ln -sfn "$previous" "${TARGET_DIR}.previous"
    mv -Tf "${TARGET_DIR}.previous" "$TARGET_DIR"
    "$TARGET_DIR/scripts/install.sh" --install-all || true
  fi
}
trap rollback ERR

TARGET_DIR="$TARGET_DIR" "$TARGET_DIR/scripts/install.sh" --install-all
TARGET_DIR="$TARGET_DIR" "$TARGET_DIR/scripts/post-install-check.sh"
trap - ERR

echo "operations release deployed: $RELEASE_ID"
