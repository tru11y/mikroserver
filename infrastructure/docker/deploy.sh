#!/bin/bash
# MikroServer — Production Deploy Script
# Usage: bash deploy.sh
set -e

COMPOSE="docker compose --env-file infrastructure/docker/.env -f infrastructure/docker/docker-compose.prod.yml"
ENV_FILE="infrastructure/docker/.env"

cd /root/mikroserver

wait_for_service_health() {
  local service="$1"
  local timeout_seconds="${2:-90}"
  local start_time
  start_time=$(date +%s)

  while true; do
    local container_id
    container_id=$($COMPOSE ps -q "$service" 2>/dev/null || true)

    if [ -n "$container_id" ]; then
      local status
      status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)

      case "$status" in
        healthy|running)
          echo "  $service: $status"
          return 0
          ;;
        unhealthy|exited|dead)
          echo "  $service: $status"
          echo "  Derniers logs $service:"
          docker logs --tail 200 "$container_id" || true
          return 1
          ;;
      esac
    fi

    if [ $(( $(date +%s) - start_time )) -ge "$timeout_seconds" ]; then
      echo "  $service: timeout d'attente (${timeout_seconds}s)"
      if [ -n "$container_id" ]; then
        echo "  Derniers logs $service:"
        docker logs --tail 200 "$container_id" || true
      fi
      return 1
    fi

    sleep 3
  done
}

echo "==> [1/5] git pull"
git pull origin main

echo "==> [2/5] Génération du .env (si absent)"
if [ ! -f "$ENV_FILE" ]; then
  echo "  .env introuvable — création automatique..."

  # Try to recover JWT secrets from running api container
  JWT_ACCESS=$(docker inspect docker-api-1 2>/dev/null \
    | grep -oP '"JWT_ACCESS_SECRET=\K[^"]+' | head -1)
  JWT_REFRESH=$(docker inspect docker-api-1 2>/dev/null \
    | grep -oP '"JWT_REFRESH_SECRET=\K[^"]+' | head -1)
  REDIS_PASS=$(docker inspect docker-redis-1 2>/dev/null \
    | grep -oP '"REDIS_PASSWORD=\K[^"]+' | head -1)

  # Generate new secrets if not recovered
  [ -z "$JWT_ACCESS" ]  && JWT_ACCESS=$(openssl rand -hex 64)
  [ -z "$JWT_REFRESH" ] && JWT_REFRESH=$(openssl rand -hex 64)
  [ -z "$REDIS_PASS" ]  && REDIS_PASS=$(openssl rand -hex 32)

  cat > "$ENV_FILE" << EOF
# PostgreSQL
POSTGRES_USER=mikroserver
POSTGRES_DB=mikroserver
POSTGRES_PASSWORD=

# Redis
REDIS_PASSWORD=${REDIS_PASS}

# JWT
JWT_ACCESS_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}

# Wave CI (à compléter)
WAVE_API_KEY=
WAVE_WEBHOOK_SECRET=
WAVE_SUCCESS_URL=http://139.84.241.27/portal
WAVE_ERROR_URL=http://139.84.241.27/portal
WAVE_ALLOWED_IPS=

# CinetPay (optionnel)
CINETPAY_API_URL=
CINETPAY_SITE_ID=
CINETPAY_API_KEY=
CINETPAY_WEBHOOK_SECRET=
CINETPAY_CURRENCY=XOF
CINETPAY_DEFAULT_CHANNEL=MOBILE_MONEY
CINETPAY_NOTIFY_URL=
CINETPAY_RETURN_URL=
CINETPAY_ALLOWED_IPS=
EOF
  echo "  .env créé : $ENV_FILE"
else
  echo "  .env existant conservé."
fi

echo "==> [3/5] Migrations Prisma"
$COMPOSE run --rm --build db-migrate

echo "==> [4/6] Dépendances runtime (postgres + redis)"
$COMPOSE up -d postgres redis
wait_for_service_health postgres 60
wait_for_service_health redis 90

echo "==> [5/6] Build & démarrage (api + dashboard)"
if ! $COMPOSE up -d --build api dashboard; then
  echo "  Echec du démarrage api/dashboard. Etat des containers:"
  $COMPOSE ps || true

  api_container=$($COMPOSE ps -q api 2>/dev/null || true)
  if [ -n "$api_container" ]; then
    echo "  Derniers logs api:"
    docker logs --tail 200 "$api_container" || true
  fi

  redis_container=$($COMPOSE ps -q redis 2>/dev/null || true)
  if [ -n "$redis_container" ]; then
    echo "  Derniers logs redis:"
    docker logs --tail 200 "$redis_container" || true
  fi

  exit 1
fi

wait_for_service_health api 120

echo "==> [6/6] Statut des containers"
$COMPOSE ps

echo ""
echo "✓ Déploiement terminé."
echo "  API       : http://139.84.241.27:3000/api/v1/health/live"
echo "  Dashboard : http://139.84.241.27:3001"
