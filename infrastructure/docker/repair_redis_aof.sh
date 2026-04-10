#!/bin/bash
# Safe Redis AOF recovery for production.
# - Backs up the Redis data volume
# - Repairs the multi-part AOF manifest in-place
# - Restarts only Redis so deploy.sh can be rerun afterwards

set -euo pipefail

COMPOSE="docker compose --env-file infrastructure/docker/.env -f infrastructure/docker/docker-compose.prod.yml"
BACKUP_ROOT="/root/redis-recovery"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

cd /root/mikroserver

resolve_redis_volume() {
  local redis_container
  local volume_name
  redis_container=$($COMPOSE ps -q redis 2>/dev/null || true)

  if [ -n "$redis_container" ]; then
    volume_name=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$redis_container" 2>/dev/null || true)
    if [ -n "$volume_name" ]; then
      echo "$volume_name"
      return
    fi
  fi

  docker volume ls --format '{{.Name}}' | grep -E '(^|_)redis-data$' | head -n 1 || true
}

wait_for_redis_health() {
  local timeout_seconds="${1:-90}"
  local start_time
  start_time=$(date +%s)

  while true; do
    local container_id
    container_id=$($COMPOSE ps -q redis 2>/dev/null || true)

    if [ -n "$container_id" ]; then
      local status
      status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)

      case "$status" in
        healthy|running)
          echo "Redis: $status"
          return 0
          ;;
        unhealthy|exited|dead)
          echo "Redis: $status"
          echo "Derniers logs Redis:"
          docker logs --tail 200 "$container_id" || true
          return 1
          ;;
      esac
    fi

    if [ $(( $(date +%s) - start_time )) -ge "$timeout_seconds" ]; then
      echo "Timeout d'attente Redis (${timeout_seconds}s)"
      if [ -n "${container_id:-}" ]; then
        docker logs --tail 200 "$container_id" || true
      fi
      return 1
    fi

    sleep 3
  done
}

echo "==> Resolution du volume Redis"
REDIS_VOLUME="$(resolve_redis_volume)"
if [ -z "$REDIS_VOLUME" ]; then
  echo "Impossible de trouver le volume Redis (/data)." >&2
  exit 1
fi
echo "  Volume Redis: $REDIS_VOLUME"

echo "==> Arret des services dependants Redis"
$COMPOSE stop api dashboard redis || true

echo "==> Backup du volume Redis"
mkdir -p "$BACKUP_DIR"
docker run --rm \
  -v "${REDIS_VOLUME}:/data:ro" \
  -v "${BACKUP_DIR}:/backup" \
  redis:7-alpine \
  sh -lc 'tar -czf /backup/redis-data-before-repair.tar.gz -C /data .'
echo "  Backup cree: ${BACKUP_DIR}/redis-data-before-repair.tar.gz"

echo "==> Inspection de l'AOF"
docker run --rm \
  -v "${REDIS_VOLUME}:/data:ro" \
  redis:7-alpine \
  sh -lc 'ls -la /data && echo "" && ls -la /data/appendonlydir'

echo "==> Reparation de l'AOF multi-part"
docker run --rm -i \
  -v "${REDIS_VOLUME}:/data" \
  redis:7-alpine \
  sh -lc '
    manifest=/data/appendonlydir/appendonly.aof.manifest
    if [ ! -f "$manifest" ]; then
      echo "Manifest introuvable: $manifest" >&2
      exit 1
    fi
    printf "y\n" | redis-check-aof --fix "$manifest"
  '

echo "==> Redemarrage Redis"
$COMPOSE up -d redis
wait_for_redis_health 90

echo "==> Termine"
echo "Redis est repare. Relancer ensuite:"
echo "  bash infrastructure/docker/deploy.sh"
