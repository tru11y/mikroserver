# WireGuard peer management (server / wg0)

How the VPS hub manages router peers on `wg0` (subnet `10.66.66.0/24`, server
`10.66.66.1`, port `51820/udp`).

## Principle

Router peers do **not** live in `wg0.conf`. They are:

1. **Applied live** via `wg set wg0 peer …` (effective immediately, persists while
   the service runs).
2. **Persisted** to `/etc/wireguard/peers.d/<routerId>.conf` (one `[Peer]` stanza
   per router) so they survive a reboot / service restart.
3. **Re-aggregated at start** by `reload-peers.sh`, triggered from `wg0.conf`'s
   `PostUp`.

`wg0.conf` therefore holds only the `[Interface]` section — it is never rewritten
per peer (no `wg-quick save`, which would clobber it).

## Files

### `/etc/wireguard/wg0.conf`

```ini
[Interface]
Address    = 10.66.66.1/24
ListenPort = 51820
PrivateKey = <SERVER_PRIVATE_KEY>
# Re-aggregate dynamically-managed peers on (re)start
PostUp     = /etc/wireguard/reload-peers.sh %i
```

### `/etc/wireguard/reload-peers.sh`

```sh
#!/bin/sh
set -eu
IFACE="${1:-wg0}"
PEERS_DIR="/etc/wireguard/peers.d"
[ -d "$PEERS_DIR" ] || exit 0
for f in "$PEERS_DIR"/*.conf; do
  [ -e "$f" ] || continue          # empty dir
  wg addconf "$IFACE" "$f"         # merge [Peer] (additive, idempotent)
done
```

`wg addconf` (not `syncconf`) is additive: re-running it never drops peers already
loaded. Each router's file is:

```ini
[Peer]
PublicKey  = <ROUTER_PUBLIC_KEY>
AllowedIPs = 10.66.66.150/32
```

## Backend responsibilities (`WgPeerManager`)

| Op | Live action | Persistence |
|----|-------------|-------------|
| `addPeer(routerId, pub, ip)` | `wg set wg0 peer <pub> allowed-ips <ip>/32` | write `peers.d/<routerId>.conf` |
| `removePeer(routerId, pub)` | `wg set wg0 peer <pub> remove` | `rm peers.d/<routerId>.conf` |
| `listPeersWithHandshake()` | parse `wg show wg0 dump` | — |

- Files are named by **router UUID**, not by public key: readable, and stable
  across reprovision (same router keeps the same file; only the key changes).
- The API container acts on the host network namespace via
  `nsenter --target 1 --net --mount` (requires `SYS_ADMIN` + `apparmor:unconfined`,
  see project memory `wg0 No such device = nsenter caps`).

## Reprovision & revoke

- **Reprovision**: `removePeer(routerId, oldPub)` then `addPeer(routerId, newPub, sameIp)`
  — the same `peers.d/<routerId>.conf` is rewritten with the new key.
- **Revoke**: `removePeer` drops the live peer and its file; the DB row goes
  `REVOKED`, freeing its IP and DNAT port block for reuse.
