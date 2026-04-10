#!/usr/bin/env bash
# Canonical VPS release flow for MikroServer.
# Run this script directly on the VPS shell (root or sudo).

set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://github.com/tru11y/mikroserver.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/root/mikroserver}"
LEGACY_DIR="${APP_DIR}-legacy-$(date +%Y%m%d%H%M%S)"
COMPOSE_FILE="${APP_DIR}/infrastructure/docker/docker-compose.prod.yml"
ENV_FILE="${APP_DIR}/infrastructure/docker/.env.prod"
MIN_FREE_MB="${MIN_FREE_MB:-3000}"
FULL_REBUILD="${FULL_REBUILD:-false}"
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-docker}"
LOCK_FILE="${LOCK_FILE:-/var/lock/mikroserver-vps-release.lock}"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
  printf '[%s] ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

compose() {
  docker compose \
    --project-name "${COMPOSE_PROJECT}" \
    -f "${COMPOSE_FILE}" \
    --env-file "${ENV_FILE}" \
    "$@"
}

acquire_lock() {
  exec 200>"${LOCK_FILE}"
  if ! flock -n 200; then
    die "Another vps_release.sh execution is already running (lock: ${LOCK_FILE})"
  fi
}

ensure_disk_space() {
  local avail_mb
  avail_mb="$(df -Pm / | awk 'NR==2 {print $4}')"
  log "Available disk before cleanup: ${avail_mb}MB"

  if [[ "${avail_mb}" -lt "${MIN_FREE_MB}" ]]; then
    log "Low disk space detected (< ${MIN_FREE_MB}MB). Running safe Docker cleanup."
    docker container prune -f >/dev/null 2>&1 || true
    docker image prune -af >/dev/null 2>&1 || true
    docker builder prune -af >/dev/null 2>&1 || true
    docker system df || true

    avail_mb="$(df -Pm / | awk 'NR==2 {print $4}')"
    log "Available disk after cleanup: ${avail_mb}MB"
  fi
}

require_cmd git
require_cmd docker
require_cmd curl
require_cmd flock
docker compose version >/dev/null 2>&1 || die "Docker Compose plugin is required"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  if [[ -d "${APP_DIR}" ]]; then
    log "No git repository detected in ${APP_DIR}. Moving it to ${LEGACY_DIR}"
    mv "${APP_DIR}" "${LEGACY_DIR}"
  fi

  log "Cloning ${REPO_URL} (${BRANCH}) into ${APP_DIR}"
  git clone --branch "${BRANCH}" --single-branch "${REPO_URL}" "${APP_DIR}"

  if [[ -f "${LEGACY_DIR}/infrastructure/docker/.env.prod" ]]; then
    log "Restoring .env.prod from legacy directory"
    cp "${LEGACY_DIR}/infrastructure/docker/.env.prod" "${ENV_FILE}"
    chmod 600 "${ENV_FILE}" || true
  fi
else
  log "Git repository detected in ${APP_DIR}"
  git -C "${APP_DIR}" fetch origin
  git -C "${APP_DIR}" checkout "${BRANCH}"
  git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
fi

[[ -f "${ENV_FILE}" ]] || die "Missing production env file: ${ENV_FILE}"
[[ -f "${COMPOSE_FILE}" ]] || die "Missing compose file: ${COMPOSE_FILE}"

acquire_lock
log "Using compose project: ${COMPOSE_PROJECT}"

required_files=(
  "${APP_DIR}/backend/src/modules/payments/providers/mock.provider.ts"
  "${APP_DIR}/backend/src/modules/users/users.controller.ts"
  "${APP_DIR}/backend/src/modules/users/users.service.ts"
)

for file_path in "${required_files[@]}"; do
  [[ -f "${file_path}" ]] || die "Required file not found: ${file_path}"
done

cd "${APP_DIR}"

ensure_disk_space

services="$(compose config --services)"

build_targets=("api" "dashboard")
if grep -qx "db-migrate" <<< "${services}"; then
  build_targets+=("db-migrate")
fi

log "Building images: ${build_targets[*]}"
if [[ "${FULL_REBUILD}" == "true" ]]; then
  compose build --no-cache "${build_targets[@]}"
else
  compose build "${build_targets[@]}"
fi

if grep -qx "db-migrate" <<< "${services}"; then
  log "Running database migrations"
  compose run --rm db-migrate
else
  log "db-migrate service not present, skipping migrations"
fi

start_and_wait_api() {
  log "Starting API service"
  compose up -d --no-deps --force-recreate api

  for attempt in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:3000/api/v1/health/live" >/dev/null 2>&1; then
      log "API health check OK"
      return 0
    fi
    sleep 3
  done

  log "API failed health check. Dumping recent API logs:"
  compose logs --tail 200 api || true
  die "API did not become healthy"
}

start_and_wait_dashboard() {
  log "Starting dashboard service"
  compose up -d --no-deps --force-recreate dashboard

  for attempt in $(seq 1 30); do
    if curl -fsSI "http://127.0.0.1:3001/login" >/dev/null 2>&1; then
      log "Dashboard health check OK"
      return 0
    fi
    sleep 3
  done

  log "Dashboard failed health check. Dumping recent dashboard logs:"
  compose logs --tail 200 dashboard || true
  die "Dashboard did not become healthy"
}

up_services=()
if grep -qx "nginx" <<< "${services}"; then
  SSL_DIR="${APP_DIR}/infrastructure/nginx/ssl"
  FULLCHAIN_PATH="${SSL_DIR}/fullchain.pem"
  PRIVKEY_PATH="${SSL_DIR}/privkey.pem"

  mkdir -p "${SSL_DIR}"
  if [[ ! -f "${FULLCHAIN_PATH}" || ! -f "${PRIVKEY_PATH}" ]]; then
    require_cmd openssl
    log "TLS certificate not found. Generating self-signed fallback certificate."
    openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
      -subj "/CN=$(hostname -f 2>/dev/null || hostname)" \
      -keyout "${PRIVKEY_PATH}" \
      -out "${FULLCHAIN_PATH}" >/dev/null 2>&1
    chmod 600 "${PRIVKEY_PATH}" || true
  fi
  [[ -s "${FULLCHAIN_PATH}" ]] || die "Generated certificate is empty: ${FULLCHAIN_PATH}"
  [[ -s "${PRIVKEY_PATH}" ]] || die "Generated key is empty: ${PRIVKEY_PATH}"
  up_services+=("nginx")
fi

start_and_wait_api
start_and_wait_dashboard

if [[ " ${up_services[*]} " == *" nginx "* ]]; then
  log "Starting nginx service"
  compose up -d --no-deps --force-recreate nginx
  sleep 3
fi

log "Verifying expected users routes are mapped in API logs"
api_logs="$(compose logs --tail 300 api || true)"
grep -q "/api/users/:id/profile" <<< "${api_logs}" || die "Route /api/users/:id/profile not found in API startup logs"
grep -q "/api/users/:id/password" <<< "${api_logs}" || die "Route /api/users/:id/password not found in API startup logs"

if [[ -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
  log "Running optional admin login smoke test"
  login_code="$(
    curl -sS -o /tmp/mikroserver-login-smoke.json -w "%{http_code}" \
      -H "Content-Type: application/json" \
      -X POST "http://127.0.0.1:3000/api/v1/auth/login" \
      -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}"
  )"
  [[ "${login_code}" == "200" || "${login_code}" == "201" ]] || die "Admin login smoke test failed with HTTP ${login_code}"
  log "Admin login smoke test OK (HTTP ${login_code})"
fi

log "Current compose status"
compose ps

log "Release completed successfully"
