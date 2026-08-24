#!/usr/bin/env bash
set -Eeuo pipefail

warn=0
critical=0

pass() { printf 'PASS %s\n' "$1"; }
warning() { printf 'WARN %s\n' "$1" >&2; warn=$((warn + 1)); }
fail() { printf 'FAIL %s\n' "$1" >&2; critical=$((critical + 1)); }

[[ "$(id -u)" -eq 0 ]] || warning "execute como root para verificar todas as configurações"

if command -v docker >/dev/null 2>&1; then
  docker info >/dev/null 2>&1 && pass "Docker responde" || fail "Docker não responde"
  docker compose version >/dev/null 2>&1 && pass "Docker Compose disponível" || fail "Docker Compose indisponível"
else
  fail "Docker não instalado"
fi

root_use="$(df -P / | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
if [[ "$root_use" -lt 80 ]]; then pass "disco raiz em ${root_use}%";
elif [[ "$root_use" -lt 90 ]]; then warning "disco raiz em ${root_use}%";
else fail "disco raiz crítico em ${root_use}%"; fi

docker_root="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || true)"
if [[ -n "$docker_root" && -d "$docker_root" ]]; then
  docker_use="$(df -P "$docker_root" | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
  if [[ "$docker_use" -lt 80 ]]; then pass "armazenamento Docker em ${docker_use}%";
  elif [[ "$docker_use" -lt 90 ]]; then warning "armazenamento Docker em ${docker_use}%";
  else fail "armazenamento Docker crítico em ${docker_use}%"; fi
fi

available_kb="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)"
total_kb="$(awk '/MemTotal:/ {print $2}' /proc/meminfo)"
available_pct=$((available_kb * 100 / total_kb))
if [[ "$available_pct" -ge 15 ]]; then pass "memória disponível em ${available_pct}%";
elif [[ "$available_pct" -ge 8 ]]; then warning "memória disponível em ${available_pct}%";
else fail "memória disponível crítica em ${available_pct}%"; fi

if timedatectl show -p NTPSynchronized --value 2>/dev/null | grep -qx yes; then
  pass "relógio sincronizado por NTP"
else
  warning "sincronização NTP não confirmada"
fi

if command -v ufw >/dev/null 2>&1; then
  ufw status | grep -q '^Status: active' && pass "UFW ativo" || warning "UFW não está ativo"
elif command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --state 2>/dev/null | grep -qx running && pass "firewalld ativo" || warning "firewalld não está ativo"
else
  warning "firewall do host não detectado; confirme firewall no provedor"
fi

sshd_config="$(sshd -T 2>/dev/null || true)"
if [[ -n "$sshd_config" ]]; then
  grep -q '^permitrootlogin no$' <<<"$sshd_config" && pass "login SSH root desabilitado" || warning "login SSH root não está explicitamente desabilitado"
  grep -q '^passwordauthentication no$' <<<"$sshd_config" && pass "senha SSH desabilitada" || warning "autenticação SSH por senha está habilitada"
else
  warning "configuração efetiva do SSH não pôde ser lida"
fi

if systemctl is-enabled --quiet unattended-upgrades 2>/dev/null || systemctl is-enabled --quiet dnf-automatic.timer 2>/dev/null; then
  pass "atualizações automáticas de segurança habilitadas"
else
  warning "atualizações automáticas de segurança não confirmadas"
fi

printf 'SUMMARY warnings=%d critical=%d\n' "$warn" "$critical"
[[ "$critical" -eq 0 ]]
