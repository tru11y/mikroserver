#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<EOF
Usage: infrastructure/scripts/ops.sh <command>

Commands:
  deploy:prod        Build and deploy production services
  deploy:staging     Build and deploy staging services
  certbot:renew      Renew certificates and reload nginx
  iptables:restore   Restore persisted iptables rules
EOF
}

cmd="${1:-}"

case "$cmd" in
  deploy:prod)
    docker compose -f infrastructure/docker/docker-compose.prod.yml up -d --build api dashboard nginx
    ;;
  deploy:staging)
    bash infrastructure/scripts/deploy_staging.sh
    ;;
  certbot:renew)
    bash infrastructure/scripts/certbot_renew.sh
    ;;
  iptables:restore)
    bash infrastructure/scripts/restore-iptables.sh
    ;;
  *)
    usage
    exit 1
    ;;
esac
