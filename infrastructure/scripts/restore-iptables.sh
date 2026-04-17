#!/bin/bash
# =============================================================================
# HotspotFlow — iptables DNAT restore script
# Called by systemd at startup (after WireGuard is up) to re-apply all active
# port-mapping rules stored in the database.
#
# Install:
#   cp infrastructure/scripts/restore-iptables.sh /opt/hotspotflow/restore-iptables.sh
#   chmod +x /opt/hotspotflow/restore-iptables.sh
#   cp infrastructure/systemd/hotspotflow-iptables.service /etc/systemd/system/
#   systemctl daemon-reload
#   systemctl enable hotspotflow-iptables.service
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — override via environment or edit here
# ---------------------------------------------------------------------------

# Local NestJS API (running inside Docker on host port 3001, or adjust as needed)
API_BASE_URL="${HOTSPOTFLOW_API_URL:-http://localhost:3001/api/v1}"

# Service account JWT token with ADMIN role for the restore endpoint.
# Generate once with: POST /api/v1/auth/login  →  copy accessToken
# Store in /etc/hotspotflow/api-token (chmod 600, owned by root)
TOKEN_FILE="${HOTSPOTFLOW_TOKEN_FILE:-/etc/hotspotflow/api-token}"

# Retry settings
MAX_RETRIES=10
RETRY_DELAY=5   # seconds between retries (API may not be up immediately)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] restore-iptables: $*"
}

# ---------------------------------------------------------------------------
# Wait for API to become ready
# ---------------------------------------------------------------------------

wait_for_api() {
  local attempt=1
  while [ "$attempt" -le "$MAX_RETRIES" ]; do
    if curl -sf --max-time 3 "${API_BASE_URL}/health" > /dev/null 2>&1; then
      return 0
    fi
    log "API not ready yet (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY}s…"
    sleep "$RETRY_DELAY"
    attempt=$((attempt + 1))
  done
  return 1
}

# ---------------------------------------------------------------------------
# Read token
# ---------------------------------------------------------------------------

if [ ! -f "$TOKEN_FILE" ]; then
  log "ERROR: token file not found: $TOKEN_FILE"
  log "Create it with: echo 'YOUR_ACCESS_TOKEN' > $TOKEN_FILE && chmod 600 $TOKEN_FILE"
  exit 1
fi

TOKEN="$(cat "$TOKEN_FILE" | tr -d '[:space:]')"

if [ -z "$TOKEN" ]; then
  log "ERROR: token file is empty: $TOKEN_FILE"
  exit 1
fi

# ---------------------------------------------------------------------------
# Wait for API
# ---------------------------------------------------------------------------

log "Waiting for HotspotFlow API at ${API_BASE_URL}…"
if ! wait_for_api; then
  log "ERROR: API did not become ready after ${MAX_RETRIES} attempts — iptables rules NOT restored"
  exit 1
fi

log "API is up."

# ---------------------------------------------------------------------------
# Call restore endpoint
# ---------------------------------------------------------------------------

log "Calling POST ${API_BASE_URL}/admin/port-mapping/restore-all …"

HTTP_STATUS=$(curl -sf \
  --max-time 30 \
  -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -o /tmp/restore-iptables-response.json \
  -w "%{http_code}" \
  "${API_BASE_URL}/admin/port-mapping/restore-all" 2>&1)

CURL_EXIT=$?

if [ "$CURL_EXIT" -ne 0 ]; then
  log "ERROR: curl failed (exit $CURL_EXIT)"
  exit 1
fi

if [ "$HTTP_STATUS" = "200" ]; then
  log "OK — iptables rules restored successfully (HTTP 200)"
  cat /tmp/restore-iptables-response.json 2>/dev/null || true
  echo
  exit 0
else
  log "ERROR: API returned HTTP ${HTTP_STATUS}"
  cat /tmp/restore-iptables-response.json 2>/dev/null || true
  echo
  exit 1
fi
