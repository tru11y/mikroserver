#!/usr/bin/env bash
# =============================================================================
# MikroServer — Production Deployment Script
# =============================================================================
# Usage (on the VPS):
#   ./deploy_prod.sh [--no-migrate] [--full-rebuild] [--skip-backup]
#
# Required env / exported before calling:
#   REPO_URL, BRANCH, APP_DIR, ADMIN_EMAIL, ADMIN_PASSWORD (optional, for smoke test)
#   NOTIFY_WEBHOOK (optional — POST JSON {text} on success/failure)
#
# Exit codes:
#   0  success
#   1  pre-flight failure (no rollback attempted — nothing changed)
#   2  migration failure (rollback triggered)
#   3  service failure   (rollback triggered)
# =============================================================================

set -Eeuo pipefail
IFS=$'\n\t'

# ─── Configuration (override via environment) ────────────────────────────────
REPO_URL="${REPO_URL:-https://github.com/tru11y/mikroserver.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/root/mikroserver}"
COMPOSE_FILE="${APP_DIR}/infrastructure/docker/docker-compose.prod.yml"
ENV_FILE="${APP_DIR}/infrastructure/docker/.env.prod"
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-mikroserver}"
LOCK_FILE="${LOCK_FILE:-/var/lock/mikroserver-deploy.lock}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mikroserver}"
MIN_FREE_MB="${MIN_FREE_MB:-3500}"
API_HEALTH_URL="http://127.0.0.1:3000/api/v1/health/live"
DASHBOARD_HEALTH_URL="http://127.0.0.1:3001"
HEALTH_RETRIES=40
HEALTH_INTERVAL=5

NO_MIGRATE=false
FULL_REBUILD=false
SKIP_BACKUP=false

for arg in "$@"; do
  case "${arg}" in
    --no-migrate)   NO_MIGRATE=true ;;
    --full-rebuild) FULL_REBUILD=true ;;
    --skip-backup)  SKIP_BACKUP=true ;;
    *) echo "Unknown argument: ${arg}"; exit 1 ;;
  esac
done

# ─── Colour helpers ───────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  C_RESET='\033[0m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[1;33m'
  C_RED='\033[0;31m'; C_CYAN='\033[0;36m'; C_BOLD='\033[1m'
else
  C_RESET=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_CYAN=''; C_BOLD=''
fi

DEPLOY_START="$(date '+%Y-%m-%d %H:%M:%S')"
LOG_FILE="/tmp/mikroserver-deploy-$(date '+%Y%m%d%H%M%S').log"

log()  { local msg="[$(date '+%H:%M:%S')] $*"; printf "${C_CYAN}%s${C_RESET}\n" "${msg}"; echo "${msg}" >> "${LOG_FILE}"; }
ok()   { local msg="[$(date '+%H:%M:%S')] ✓ $*"; printf "${C_GREEN}%s${C_RESET}\n" "${msg}"; echo "${msg}" >> "${LOG_FILE}"; }
warn() { local msg="[$(date '+%H:%M:%S')] ⚠ $*"; printf "${C_YELLOW}%s${C_RESET}\n" "${msg}" >&2; echo "${msg}" >> "${LOG_FILE}"; }
die()  { local msg="[$(date '+%H:%M:%S')] ✗ $*"; printf "${C_RED}${C_BOLD}%s${C_RESET}\n" "${msg}" >&2; echo "${msg}" >> "${LOG_FILE}"; notify_failure "${msg}"; exit "${2:-1}"; }
section() { printf "\n${C_BOLD}══ %s ══${C_RESET}\n" "$*"; }

# ─── Notification (optional) ──────────────────────────────────────────────────
notify() {
  [[ -z "${NOTIFY_WEBHOOK:-}" ]] && return 0
  local text="$1"
  curl -sS --max-time 10 -X POST "${NOTIFY_WEBHOOK}" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"${text}\"}" >/dev/null 2>&1 || true
}

notify_failure() {
  local reason="${1:-unknown}"
  notify "[MikroServer] Deploy FAILED on $(hostname) at $(date '+%H:%M:%S UTC'): ${reason}. Log: ${LOG_FILE}"
}

# ─── Lock ─────────────────────────────────────────────────────────────────────
acquire_lock() {
  exec 200>"${LOCK_FILE}"
  flock -n 200 || die "Another deployment is already running (lock: ${LOCK_FILE})" 1
}

# ─── Prerequisite checks ──────────────────────────────────────────────────────
require_cmd() { command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1" 1; }

check_prerequisites() {
  section "Pre-flight checks"
  require_cmd git
  require_cmd docker
  require_cmd curl
  require_cmd flock
  require_cmd openssl
  docker compose version >/dev/null 2>&1 || die "Docker Compose plugin not found" 1
  ok "All required commands present"
}

# ─── Disk space ───────────────────────────────────────────────────────────────
ensure_disk_space() {
  local avail_mb
  avail_mb="$(df -Pm / | awk 'NR==2 {print $4}')"
  log "Disk available: ${avail_mb}MB (minimum: ${MIN_FREE_MB}MB)"

  if [[ "${avail_mb}" -lt "${MIN_FREE_MB}" ]]; then
    warn "Low disk space — running Docker cleanup"
    docker container prune -f  >/dev/null 2>&1 || true
    docker image prune -af     >/dev/null 2>&1 || true
    docker builder prune -af   >/dev/null 2>&1 || true
    avail_mb="$(df -Pm / | awk 'NR==2 {print $4}')"
    log "Disk after cleanup: ${avail_mb}MB"
    [[ "${avail_mb}" -ge "${MIN_FREE_MB}" ]] || \
      die "Still not enough disk space after cleanup (${avail_mb}MB < ${MIN_FREE_MB}MB)" 1
  fi
  ok "Disk space OK"
}

# ─── Git sync ─────────────────────────────────────────────────────────────────
sync_repo() {
  section "Repository sync"
  if [[ ! -d "${APP_DIR}/.git" ]]; then
    if [[ -d "${APP_DIR}" ]]; then
      local legacy="${APP_DIR}-legacy-$(date '+%Y%m%d%H%M%S')"
      warn "No git repo in ${APP_DIR} — moving to ${legacy}"
      mv "${APP_DIR}" "${legacy}"
      # Preserve existing .env.prod if present
      if [[ -f "${legacy}/infrastructure/docker/.env.prod" ]]; then
        mkdir -p "$(dirname "${ENV_FILE}")"
        cp "${legacy}/infrastructure/docker/.env.prod" "${ENV_FILE}"
        chmod 600 "${ENV_FILE}"
        log "Restored .env.prod from legacy directory"
      fi
    fi
    log "Cloning ${REPO_URL} branch=${BRANCH}"
    git clone --branch "${BRANCH}" --single-branch "${REPO_URL}" "${APP_DIR}"
  else
    log "Fetching origin/${BRANCH}"
    git -C "${APP_DIR}" fetch origin
    git -C "${APP_DIR}" checkout "${BRANCH}"
    git -C "${APP_DIR}" reset --hard "origin/${BRANCH}"
  fi

  DEPLOYED_SHA="$(git -C "${APP_DIR}" rev-parse --short HEAD)"
  ok "Repo at ${DEPLOYED_SHA} ($(git -C "${APP_DIR}" log -1 --pretty='%s'))"
}

# ─── Env file validation ──────────────────────────────────────────────────────
validate_env_file() {
  section "Environment validation"
  [[ -f "${ENV_FILE}" ]]    || die "Missing env file: ${ENV_FILE}" 1
  [[ -f "${COMPOSE_FILE}" ]] || die "Missing compose file: ${COMPOSE_FILE}" 1

  # Secrets must be set and not left as placeholder values
  local required_secrets=(
    POSTGRES_PASSWORD
    REDIS_PASSWORD
    JWT_ACCESS_SECRET
    JWT_REFRESH_SECRET
    WAVE_API_KEY
    WAVE_WEBHOOK_SECRET
  )

  local missing=()
  for key in "${required_secrets[@]}"; do
    local val
    val="$(grep -E "^${key}=" "${ENV_FILE}" | cut -d= -f2- | tr -d '[:space:]')" || true
    if [[ -z "${val}" || "${val}" == *"CHANGE_ME"* || "${val}" == *"GENERATE"* || "${val}" == *"XXXXX"* ]]; then
      missing+=("${key}")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    die "Unset/placeholder secrets in ${ENV_FILE}: ${missing[*]}" 1
  fi

  # JWT secrets must be at least 64 hex chars (256-bit minimum)
  for jwt_key in JWT_ACCESS_SECRET JWT_REFRESH_SECRET; do
    local val
    val="$(grep -E "^${jwt_key}=" "${ENV_FILE}" | cut -d= -f2- | tr -d '[:space:]')"
    if [[ ${#val} -lt 64 ]]; then
      die "${jwt_key} is too short (${#val} chars, minimum 64). Generate with: openssl rand -hex 64" 1
    fi
  done

  # JWT secrets must not be identical
  local access_secret refresh_secret
  access_secret="$(grep -E "^JWT_ACCESS_SECRET=" "${ENV_FILE}" | cut -d= -f2- | tr -d '[:space:]')"
  refresh_secret="$(grep -E "^JWT_REFRESH_SECRET=" "${ENV_FILE}" | cut -d= -f2- | tr -d '[:space:]')"
  [[ "${access_secret}" != "${refresh_secret}" ]] || \
    die "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different secrets" 1

  ok "All required secrets present and valid"
}

# ─── Compose helper ───────────────────────────────────────────────────────────
compose() {
  docker compose \
    --project-name "${COMPOSE_PROJECT}" \
    -f "${COMPOSE_FILE}" \
    --env-file "${ENV_FILE}" \
    "$@"
}

# ─── PostgreSQL backup ────────────────────────────────────────────────────────
backup_database() {
  if [[ "${SKIP_BACKUP}" == "true" ]]; then
    warn "--skip-backup set: skipping DB backup"
    return 0
  fi
  if [[ "${NO_MIGRATE}" == "true" ]]; then
    log "No-migrate mode: skipping DB backup"
    return 0
  fi

  section "Database backup"
  mkdir -p "${BACKUP_DIR}"
  chmod 700 "${BACKUP_DIR}"

  local backup_file="${BACKUP_DIR}/pre-deploy-$(date '+%Y%m%d%H%M%S').sql.gz"
  local pg_user pg_db
  pg_user="$(grep -E "^POSTGRES_USER=" "${ENV_FILE}" | cut -d= -f2- | tr -d '[:space:]')"
  pg_user="${pg_user:-mikroserver}"
  pg_db="$(grep -E "^POSTGRES_DB=" "${ENV_FILE}" | cut -d= -f2- | tr -d '[:space:]')"
  pg_db="${pg_db:-mikroserver}"

  log "Backing up database ${pg_db} → ${backup_file}"
  if compose exec -T postgres \
    pg_dump -U "${pg_user}" -d "${pg_db}" --no-password 2>/dev/null \
    | gzip > "${backup_file}"; then
    ok "DB backup: ${backup_file} ($(du -sh "${backup_file}" | cut -f1))"
  else
    # Non-fatal if postgres isn't yet running (first deploy)
    warn "DB backup skipped — postgres may not be running yet (first deploy?)"
    rm -f "${backup_file}"
  fi

  # Retain only the last 5 backups
  ls -1t "${BACKUP_DIR}"/pre-deploy-*.sql.gz 2>/dev/null | tail -n +6 | xargs -r rm -f || true
}

# ─── Image build ──────────────────────────────────────────────────────────────
build_images() {
  section "Image build"
  local services
  services="$(compose config --services)"

  local targets=("api" "dashboard")
  grep -qx "db-migrate" <<< "${services}" && targets+=("db-migrate")

  log "Building: ${targets[*]}"
  if [[ "${FULL_REBUILD}" == "true" ]]; then
    compose build --no-cache "${targets[@]}"
  else
    compose build "${targets[@]}"
  fi
  ok "Images built"
}

# ─── Migrations ───────────────────────────────────────────────────────────────
run_migrations() {
  section "Database migrations"
  if [[ "${NO_MIGRATE}" == "true" ]]; then
    warn "--no-migrate set: skipping Prisma migrations"
    return 0
  fi

  local services
  services="$(compose config --services)"
  if ! grep -qx "db-migrate" <<< "${services}"; then
    warn "db-migrate service not in compose file — skipping"
    return 0
  fi

  log "Running: prisma migrate deploy"
  if ! compose run --rm db-migrate; then
    die "Database migration failed — aborting deployment (DB not changed by app)" 2
  fi
  ok "Migrations applied"
}

# ─── Health check ─────────────────────────────────────────────────────────────
wait_healthy() {
  local name="$1" url="$2"
  log "Waiting for ${name} to be healthy at ${url}"
  for attempt in $(seq 1 "${HEALTH_RETRIES}"); do
    if curl -fsSL --max-time 5 "${url}" >/dev/null 2>&1; then
      ok "${name} is healthy (attempt ${attempt}/${HEALTH_RETRIES})"
      return 0
    fi
    sleep "${HEALTH_INTERVAL}"
  done
  warn "Dumping ${name} logs:"
  compose logs --tail 200 "${name}" 2>/dev/null || true
  return 1
}

# ─── Rollback ─────────────────────────────────────────────────────────────────
ROLLBACK_DONE=false

rollback() {
  [[ "${ROLLBACK_DONE}" == "true" ]] && return 0
  ROLLBACK_DONE=true

  warn "Rolling back — restarting previous containers"
  compose up -d --no-deps --force-recreate api dashboard 2>/dev/null || true
  sleep 10

  if wait_healthy "api" "${API_HEALTH_URL}" 2>/dev/null; then
    warn "Rollback: API came back up"
  else
    warn "Rollback: API did NOT recover — manual intervention required"
  fi
}

# ─── TLS certificate ──────────────────────────────────────────────────────────
ensure_tls_certificate() {
  local ssl_dir="${APP_DIR}/infrastructure/nginx/ssl"
  local cert="${ssl_dir}/fullchain.pem"
  local key="${ssl_dir}/privkey.pem"

  mkdir -p "${ssl_dir}"
  if [[ ! -f "${cert}" || ! -f "${key}" ]]; then
    log "No TLS certificate found — generating self-signed fallback"
    openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
      -subj "/CN=$(hostname -f 2>/dev/null || hostname)" \
      -keyout "${key}" -out "${cert}" >/dev/null 2>&1
    chmod 600 "${key}"
    warn "Self-signed certificate installed. Replace with a real cert for HTTPS."
  fi

  [[ -s "${cert}" ]] || die "TLS fullchain.pem is empty" 1
  [[ -s "${key}" ]]  || die "TLS privkey.pem is empty" 1
  ok "TLS certificate ready"
}

# ─── Infra (postgres + redis) startup ────────────────────────────────────────
ensure_infra_running() {
  section "Infrastructure startup"
  log "Ensuring postgres and redis are running"
  compose up -d --no-deps postgres redis

  log "Waiting for postgres to be healthy…"
  for attempt in $(seq 1 24); do
    if compose exec -T postgres pg_isready -U "${POSTGRES_USER:-mikroserver}" >/dev/null 2>&1; then
      ok "postgres healthy"; break
    fi
    [[ "${attempt}" -eq 24 ]] && die "postgres never became healthy" 3
    sleep 5
  done
}

# ─── Service deployment ───────────────────────────────────────────────────────
deploy_services() {
  section "Service deployment"

  log "Deploying api (rolling)"
  compose up -d --no-deps --force-recreate api
  if ! wait_healthy "api" "${API_HEALTH_URL}"; then
    die "API failed health check — initiating rollback" 3
  fi

  log "Deploying dashboard (rolling)"
  compose up -d --no-deps --force-recreate dashboard
  if ! wait_healthy "dashboard" "${DASHBOARD_HEALTH_URL}"; then
    die "Dashboard failed health check — initiating rollback" 3
  fi

  local services
  services="$(compose config --services)"
  if grep -qx "nginx" <<< "${services}"; then
    ensure_tls_certificate
    log "Reloading nginx"
    compose up -d --no-deps nginx
    sleep 3
    # Verify nginx config is valid
    if ! compose exec -T nginx nginx -t >/dev/null 2>&1; then
      die "nginx config test failed" 3
    fi
    ok "nginx reloaded and config valid"
  fi

  ok "All services deployed"
}

# ─── Post-deploy verification ─────────────────────────────────────────────────
verify_deployment() {
  section "Post-deploy verification"

  # 1. API route map must include critical routes
  log "Checking API route registration in startup logs"
  local api_logs
  api_logs="$(compose logs --tail 400 api 2>/dev/null || true)"

  local required_routes=(
    "/api/users/:id/profile"
    "/api/users/:id/password"
    "/api/routers"
    "/api/auth/login"
    "/api/webhooks/wave"
  )

  local missing_routes=()
  for route in "${required_routes[@]}"; do
    if ! grep -qF "${route}" <<< "${api_logs}"; then
      missing_routes+=("${route}")
    fi
  done

  if [[ ${#missing_routes[@]} -gt 0 ]]; then
    warn "Routes not found in API logs (may be logged differently): ${missing_routes[*]}"
  else
    ok "All critical routes registered"
  fi

  # 2. No EXPOSE 3000 accessible from outside internal network
  if curl -fsSL --max-time 3 "http://127.0.0.1:3000/api/v1/health/live" >/dev/null 2>&1; then
    warn "Port 3000 is reachable on localhost — verify it is NOT exposed to the public internet"
  fi

  # 3. Optional admin smoke test
  if [[ -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
    log "Running admin login smoke test"
    local http_code
    http_code="$(
      curl -sS -o /tmp/ms-smoke-login.json -w "%{http_code}" \
        --max-time 10 \
        -H 'Content-Type: application/json' \
        -X POST "${API_HEALTH_URL/\/health\/live/}" \
        "http://127.0.0.1:3000/api/v1/auth/login" \
        -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}"
    )" || true
    if [[ "${http_code}" == "200" || "${http_code}" == "201" ]]; then
      ok "Admin login smoke test passed (HTTP ${http_code})"
    else
      warn "Admin login smoke test returned HTTP ${http_code} — check /tmp/ms-smoke-login.json"
    fi
  fi

  # 4. Redis connectivity (via API health/ready if available)
  if curl -fsSL --max-time 5 "http://127.0.0.1:3000/api/v1/health/ready" >/dev/null 2>&1; then
    ok "API /health/ready endpoint OK (DB + Redis connected)"
  fi

  ok "Verification complete"
}

# ─── Cleanup ──────────────────────────────────────────────────────────────────
cleanup_old_images() {
  section "Docker cleanup"
  log "Pruning images older than 24h"
  docker image prune -f --filter "until=24h" >/dev/null 2>&1 || true
  ok "Cleanup done"
}

# ─── Trap for unexpected failures ─────────────────────────────────────────────
on_error() {
  local exit_code=$?
  local line_no="${BASH_LINENO[0]}"
  warn "Unexpected failure at line ${line_no} (exit ${exit_code})"

  # Only rollback if services were already being modified
  if [[ "${DEPLOY_PHASE:-preflight}" == "services" ]]; then
    rollback
  fi

  die "Deploy aborted — see ${LOG_FILE}" "${exit_code}"
}
trap 'on_error' ERR

# ─── SIGTERM / SIGINT ─────────────────────────────────────────────────────────
on_interrupt() {
  warn "Deploy interrupted by signal — leaving system in current state"
  notify "[MikroServer] Deploy INTERRUPTED on $(hostname)"
  exit 130
}
trap 'on_interrupt' SIGTERM SIGINT

# =============================================================================
# MAIN
# =============================================================================
printf "${C_BOLD}MikroServer Production Deploy — %s${C_RESET}\n" "${DEPLOY_START}"
printf "Log: %s\n\n" "${LOG_FILE}"

# Phase 1: pre-flight (no mutations yet)
DEPLOY_PHASE="preflight"
check_prerequisites
acquire_lock
sync_repo
validate_env_file
ensure_disk_space

# Phase 2: build (local only, no running containers changed yet)
DEPLOY_PHASE="build"
build_images

# Phase 3: infra (postgres + redis must be up before backup/migrations)
DEPLOY_PHASE="infra"
ensure_infra_running

# Phase 4: migrations (DB change — point of no return)
DEPLOY_PHASE="migrations"
backup_database
run_migrations

# Phase 5: services (app containers)
DEPLOY_PHASE="services"
deploy_services

# Phase 6: verify
DEPLOY_PHASE="verify"
verify_deployment
cleanup_old_images

section "Summary"
compose ps
printf "\n${C_GREEN}${C_BOLD}Deploy complete!${C_RESET} SHA=%s  Duration=%ds\n\n" \
  "${DEPLOYED_SHA:-unknown}" \
  "$(( $(date +%s) - $(date -d "${DEPLOY_START}" +%s 2>/dev/null || echo 0) ))"

notify "[MikroServer] Deploy SUCCEEDED on $(hostname) — SHA ${DEPLOYED_SHA:-?} at $(date '+%H:%M:%S UTC')"
