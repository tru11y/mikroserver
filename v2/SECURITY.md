# Security Model — MikroServer v2

## Threat Model Summary

**Assets**: Operator credentials, customer payment data (phone numbers, transaction IDs), WireGuard private keys, RouterOS credentials, JWT signing keys.

**Threat actors**: External attackers (internet-facing API), compromised Wave webhooks, rogue operators, stolen devices with cached tokens.

**Attack surface**: HTTPS API (auth endpoints, webhook receiver, authenticated CRUD), WireGuard tunnel management, RouterOS API connections.

## Authentication & Authorization

| Layer | Mechanism |
|-------|-----------|
| Password hashing | Argon2id (m=19456 KiB, t=2, p=1) per OWASP 2024 |
| Access tokens | RS256 JWT, 15-minute TTL, kid header for rotation |
| Refresh tokens | Opaque UUID, SHA-256 hashed in DB, 30-day TTL |
| Token reuse detection | Family-based: reuse of revoked token revokes entire family |
| Role hierarchy | VIEWER < ADMIN < SUPER_ADMIN, enforced per-route |

## Webhook Security

- **HMAC-SHA256** signature verification on every Wave webhook
- **Constant-time comparison** via `MessageDigest.isEqual` to prevent timing attacks
- Rate-limited at both Nginx (100r/m) and Ktor (token bucket)
- Raw payload stored immediately (< 5ms), processing is async (store-and-queue)

## Secrets Handling

| Secret | Storage | Rotation |
|--------|---------|----------|
| DB password | Environment variable | Manual, requires restart |
| JWT private key | PEM file mounted as Docker secret | Via `kid` claim in JWT header |
| Wave webhook secret | Environment variable | Coordinate with Wave |
| WG private keys | Generated per-router, returned once, NOT stored long-term |
| RouterOS passwords | Encrypted in DB (AES-256-GCM, key from env) — **TODO: implement encryption at rest** |

## Network Security

- **WireGuard tunnel**: RouterOS API port 8728 is only accessible via 10.66.66.x/24 tunnel
- **Docker isolation**: API container uses Docker networking (not `network_mode: host`); only enters host namespace for WG operations via `nsenter`
- **Nginx**: TLS 1.2+, HSTS, X-Frame-Options DENY, CSP, rate limiting zones
- **CORS**: Explicit allowlist only (operator dashboard + mobile app origins)
- **Prometheus /metrics**: IP-restricted to localhost and private ranges

## Input Validation

- All HTTP inputs validated at the edge (Konform validators in route handlers)
- Domain layer assumes valid inputs — no defensive re-validation
- SQL injection: mitigated by Exposed's parameterized queries (no string concatenation)
- All UUIDs parsed with `UUID.fromString()` before use

## Known Residual Risks

1. **RouterOS password encryption at rest**: Currently stored as plaintext in `api_password_enc` column. Must implement AES-256-GCM encryption with key from environment before production.
2. **No IP allowlist on webhook endpoint**: Wave webhook source IPs should be allowlisted when Wave publishes their IP ranges.
3. **Single VPS**: No redundancy. WireGuard tunnel and all services run on one machine. Mitigated by Docker restart policies and systemd service for iptables restore.
4. **Privileged container**: The API container runs as `privileged` with `pid: host` for nsenter access. This is a large attack surface if the container is compromised. Mitigate by keeping the image minimal (Alpine JRE) and running rootless where possible.
5. **No audit log tamper detection**: Append-only trigger prevents SQL mutations, but a superuser could still bypass. Consider WAL-based audit or external log shipping.
6. **JWT key rotation**: `kid` header is prepared but rotation procedure is manual. Automate via secrets manager in production.
