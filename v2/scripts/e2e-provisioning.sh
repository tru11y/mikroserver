#!/usr/bin/env bash
#
# End-to-end provisioning test — RUN ON THE VPS (has wg0 and reaches the CHR).
#
#   provision -> push script to CHR (10.66.66.100) via RouterOS SSH -> wait ACTIVE
#   -> assert peer IP present in `wg show` -> reprovision -> wait ACTIVE (new key)
#   -> revoke -> assert peer IP gone.
#
# Requirements: curl, jq, ssh, wg. An operator JWT with ADMIN role.
#
# Usage:
#   BACKEND_URL=http://127.0.0.1:8080 OPERATOR_JWT=... ./e2e-provisioning.sh
#
set -euo pipefail

BACKEND_URL="${BACKEND_URL:?set BACKEND_URL}"
OPERATOR_JWT="${OPERATOR_JWT:?set OPERATOR_JWT (ADMIN)}"
CHR_HOST="${CHR_HOST:-10.66.66.100}"
CHR_USER="${CHR_USER:-admin}"
WG_IFACE="${WG_IFACE:-wg0}"
WAIT_SECONDS="${WAIT_SECONDS:-120}"

api() { # method path [json]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -fsS -X "$method" "$BACKEND_URL$path" \
      -H "Authorization: Bearer $OPERATOR_JWT" -H 'Content-Type: application/json' -d "$body"
  else
    curl -fsS -X "$method" "$BACKEND_URL$path" -H "Authorization: Bearer $OPERATOR_JWT"
  fi
}

push_to_chr() { # script-string
  # RouterOS accepts pasted commands over SSH. Our script uses single-line guards.
  ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$CHR_USER@$CHR_HOST" <<< "$1"
}

wait_active() { # routerId
  local id="$1" deadline=$(( $(date +%s) + WAIT_SECONDS )) status
  while [ "$(date +%s)" -lt "$deadline" ]; do
    status="$(api GET "/v1/routers/$id/status" | jq -r '.status')"
    echo "  status=$status"
    [ "$status" = "ACTIVE" ] && return 0
    sleep 5
  done
  echo "TIMEOUT waiting for ACTIVE" >&2; return 1
}

peer_ip_present() { # ip -> 0 if present in wg show
  wg show "$WG_IFACE" allowed-ips | grep -q "${1}/32"
}

echo "== 1. provision =="
RESP="$(api POST /v1/routers/provision '{"name":"e2e-test"}')"
ROUTER_ID="$(jq -r '.routerId' <<<"$RESP")"
EXPECTED_IP="$(jq -r '.expectedIp' <<<"$RESP")"
jq -r '.provisioningScript' <<<"$RESP" > /tmp/e2e-provision.rsc
echo "routerId=$ROUTER_ID ip=$EXPECTED_IP"

echo "== 2. push script to CHR =="
push_to_chr "$(cat /tmp/e2e-provision.rsc)"

echo "== 3. wait ACTIVE =="
wait_active "$ROUTER_ID"

echo "== 4. assert peer present in wg show =="
peer_ip_present "$EXPECTED_IP" && echo "  OK: $EXPECTED_IP present" || { echo "MISSING peer" >&2; exit 1; }

echo "== 5. reprovision (new key, same IP) =="
RESP2="$(api POST "/v1/routers/$ROUTER_ID/reprovision")"
[ "$(jq -r '.expectedIp' <<<"$RESP2")" = "$EXPECTED_IP" ] || { echo "IP changed on reprovision" >&2; exit 1; }
jq -r '.provisioningScript' <<<"$RESP2" > /tmp/e2e-reprovision.rsc
push_to_chr "$(cat /tmp/e2e-reprovision.rsc)"
wait_active "$ROUTER_ID"
echo "  OK: ACTIVE again with rotated key"

echo "== 6. revoke and assert peer gone =="
api DELETE "/v1/routers/$ROUTER_ID" >/dev/null
sleep 3
if peer_ip_present "$EXPECTED_IP"; then echo "peer STILL present after revoke" >&2; exit 1; fi
echo "  OK: $EXPECTED_IP removed from wg show"

echo "== E2E PASSED =="
