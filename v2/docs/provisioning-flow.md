# Router provisioning flow (MikroTicket-style)

## Overview

```
┌────────┐   1. detect new MikroTik on LAN        ┌──────────────┐
│ Mobile │ ─────────────────────────────────────▶ │  Mobile app  │
│  app   │                                         └──────┬───────┘
└────────┘                                                │ 2. POST /v1/routers/provision  { name }
                                                          ▼
                                                 ┌──────────────────┐
                                                 │  Backend (Ktor)  │
                                                 │ ProvisioningSvc  │
                                                 └───┬──────────────┘
   3. in one DB tx (advisory lock):                  │
      - IpAllocator  -> 10.66.66.x                    │
      - PortAllocator-> 19xx0 block                   │
      - generate X25519 keypair (priv EPHEMERAL)      │
      - INSERT router (status=PROVISIONING,           │
        wg_public_key only)                           │
   4. WgPeerManager.addPeer (wg set + peers.d)        │
   5. build RouterOS script (injects PRIVATE key)     │
                                                       ▼
                                        200 { routerId, provisioningScript,
                                              expectedIp, dnatPortBase,
                                              publicManagementUrl }
                                                       │
   6. app pushes script to router via API 8728        ▼
                                            ┌────────────────────┐
                                            │  MikroTik router   │
                                            │  wg-mikroserver ───┼──── WireGuard tunnel ───▶ VPS wg0 (10.66.66.1)
                                            │  heartbeat 5 min ──┼──── POST /{id}/heartbeat
                                            └────────────────────┘
   7. HandshakePoller (30s) sees the handshake -> status PROVISIONING → ACTIVE
```

## Security model — the router private key is never persisted

The backend generates the WireGuard keypair, but **only the public key is stored**
(column `wg_public_key`). The private key:

- lives only as a local variable in the provisioning coroutine,
- is injected once into the returned RouterOS script,
- is **never** written to the DB (there is deliberately no `wg_private_key*`
  column) and **never** logged at any level (verified by an automated no-leak
  test that scans all log output for the returned key).

Consequences:

- The provisioning script is returned **once**. There is no "re-download".
- If a router is lost/reset, you **re-provision** (a fresh explicit flow), you do
  not recover the old key.

## Reprovision

`POST /v1/routers/{id}/reprovision` (operator-owned):

1. removes the old WG peer,
2. generates a **new** keypair,
3. updates the row: new `wg_public_key`, `status=PROVISIONING`, `provisioned_at=now`,
4. **keeps the same IP and DNAT port block** — the operator keeps their management URL,
5. adds the new peer, returns a new script.

## Revoke

`DELETE /v1/routers/{id}` removes the WG peer and sets `status=REVOKED`, which
**frees the IP and port block** for reuse (partial unique indexes exclude REVOKED rows).

## curl examples

```bash
BASE=https://api.example.ci
JWT="<operator access token>"

# Provision
curl -sS -X POST "$BASE/v1/routers/provision" \
  -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' \
  -d '{"name":"Boutique Cocody"}'
# -> { "routerId": "...", "provisioningScript": "...", "expectedIp": "10.66.66.10",
#      "dnatPortBase": 19000, "publicManagementUrl": "http://<vps>:19000" }

# Status
curl -sS "$BASE/v1/routers/<id>/status" -H "Authorization: Bearer $JWT"
# -> { "status": "ACTIVE", "lastHandshakeAt": "2026-07-15T..." }

# List
curl -sS "$BASE/v1/routers" -H "Authorization: Bearer $JWT"

# Reprovision (same IP/port, new key + script)
curl -sS -X POST "$BASE/v1/routers/<id>/reprovision" -H "Authorization: Bearer $JWT"

# Revoke
curl -sS -X DELETE "$BASE/v1/routers/<id>" -H "Authorization: Bearer $JWT"

# Heartbeat (sent by the router itself, token derived from its public key)
curl -sS -X POST "$BASE/v1/routers/<id>/heartbeat" -H "Authorization: Bearer <router token>"
```

See also [wireguard-peer-management.md](wireguard-peer-management.md).
