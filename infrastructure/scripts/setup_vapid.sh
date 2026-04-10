#!/usr/bin/env bash
# =============================================================================
# MikroServer — VAPID key setup
# Run once on the VPS after first deploy, or to rotate keys.
# Usage: bash /root/mikroserver/infrastructure/scripts/setup_vapid.sh
# =============================================================================
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/root/mikroserver}"
ENV_FILE="${APP_DIR}/infrastructure/docker/.env.prod"
COMPOSE_FILE="${APP_DIR}/infrastructure/docker/docker-compose.prod.yml"
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-docker}"

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
die() { printf '[ERROR] %s\n' "$*" >&2; exit 1; }

[[ -f "${ENV_FILE}" ]] || die "Missing: ${ENV_FILE}"

# --- Generate VAPID keys using Node.js (available in the api container) ------
log "Generating VAPID keys via Node.js..."

KEYS_JSON=$(docker compose \
  --project-name "${COMPOSE_PROJECT}" \
  -f "${COMPOSE_FILE}" \
  --env-file "${ENV_FILE}" \
  exec -T api node -e "
    const webpush = require('web-push');
    const keys = webpush.generateVAPIDKeys();
    process.stdout.write(JSON.stringify(keys));
  " 2>/dev/null) || {
  # Fallback: use npx directly on the host if api container not running
  log "api container not available, trying npx web-push on host..."
  command -v node >/dev/null 2>&1 || die "Node.js not available. Start containers first and re-run."
  cd /tmp
  npm install --silent web-push >/dev/null 2>&1 || true
  KEYS_JSON=$(node -e "
    const webpush = require('/tmp/node_modules/web-push');
    const keys = webpush.generateVAPIDKeys();
    process.stdout.write(JSON.stringify(keys));
  ")
}

VAPID_PUBLIC=$(echo "${KEYS_JSON}" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).publicKey))")
VAPID_PRIVATE=$(echo "${KEYS_JSON}" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).privateKey))")

[[ -n "${VAPID_PUBLIC}" ]]  || die "Failed to extract public key"
[[ -n "${VAPID_PRIVATE}" ]] || die "Failed to extract private key"

log "VAPID Public Key : ${VAPID_PUBLIC}"

# --- Inject into .env.prod ---------------------------------------------------
log "Updating ${ENV_FILE}..."

# Remove existing VAPID lines if present
sed -i '/^VAPID_PUBLIC_KEY=/d'  "${ENV_FILE}"
sed -i '/^VAPID_PRIVATE_KEY=/d' "${ENV_FILE}"
sed -i '/^VAPID_EMAIL=/d'       "${ENV_FILE}"
sed -i '/^NEXT_PUBLIC_VAPID_PUBLIC_KEY=/d' "${ENV_FILE}"

cat >> "${ENV_FILE}" <<EOF

# --- Web Push (VAPID) — generated $(date '+%Y-%m-%d') ---
VAPID_PUBLIC_KEY=${VAPID_PUBLIC}
VAPID_PRIVATE_KEY=${VAPID_PRIVATE}
VAPID_EMAIL=mailto:admin@mikroserver.ci
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${VAPID_PUBLIC}
EOF

chmod 600 "${ENV_FILE}"
log ".env.prod updated."

# --- Rebuild dashboard (NEXT_PUBLIC_ baked at build time) --------------------
log "Rebuilding dashboard image with new VAPID public key..."
docker compose \
  --project-name "${COMPOSE_PROJECT}" \
  -f "${COMPOSE_FILE}" \
  --env-file "${ENV_FILE}" \
  build --no-cache dashboard

log "Restarting api and dashboard services..."
docker compose \
  --project-name "${COMPOSE_PROJECT}" \
  -f "${COMPOSE_FILE}" \
  --env-file "${ENV_FILE}" \
  up -d --no-deps --force-recreate api dashboard

log ""
log "✓ VAPID setup complete."
log "  Public key  : ${VAPID_PUBLIC}"
log "  Private key : (stored in .env.prod — keep secret)"
log ""
log "Push notifications are now active for authenticated users."
