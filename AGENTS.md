# MikroServer — Agent Briefing

> Read this before touching any code. Dense but complete. ~2min read.

## What This Is
WiFi monetization SaaS for MikroTik hotspot operators in Côte d'Ivoire.
Payment: Wave CI (Mobile Money XOF). Router control via RouterOS API over WireGuard VPN.

## Stack
| Layer | Tech |
|---|---|
| Backend | NestJS + Fastify, TypeScript strict, Prisma + PostgreSQL |
| Queue | BullMQ + Redis |
| Auth | JWT HS256 + Argon2id + refresh token rotation |
| Payment | Wave CI (HMAC-SHA256 webhooks) |
| Router API | `mikrotik` npm (binary RouterOS API, port 8728) over WireGuard |
| Mobile | React Native + Expo SDK ~54 + expo-router + React Query |
| Infra | Docker + Nginx + WireGuard on VPS `139.84.241.27` |

## Critical Architecture Facts

### WireGuard Topology
- VPS server: `10.66.66.1` (wg0 interface)
- Routers: `10.66.66.2–254` (assigned on provisioning)
- RouterOS API (8728) only reachable via WireGuard tunnel
- **VPS CANNOT reach router private IPs directly** (10.x/192.168.x) — chicken-and-egg

### WireGuard Provisioning Flow (CURRENT)
1. `POST /api/v1/routers` → backend generates X25519 keypair (pure Node.js, no `wg` CLI)
2. Backend adds VPS peer via `nsenter -t 1 -n -- wg set wg0 peer ...` (requires `privileged:true + pid:host`)
3. Backend returns `wgProvision: { privateKey, wgIp, vpsPublicKey, vpsEndpoint }` to mobile
4. **Mobile** pushes WG config to router via RouterOS REST API (`PUT http://ROUTER_IP:80/rest/...`)
5. Backend polls `wg show wg0 latest-handshakes` every 5s for 3 minutes
6. On handshake detected → sets `router.wireguardIp = wgIp` in DB → mobile polling sees it

### Key Generation (NO wg CLI)
```ts
import { generateKeyPairSync } from 'crypto';
const { privateKey: privDer, publicKey: pubDer } = generateKeyPairSync('x25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  publicKeyEncoding: { type: 'spki', format: 'der' },
});
const privateKey = (privDer as Buffer).subarray(16).toString('base64'); // offset 16
const publicKey  = (pubDer  as Buffer).subarray(12).toString('base64'); // offset 12
```

### RouterOS REST API (mobile → router, v7+ only)
```ts
// PUT (not POST) to add resources
PUT http://ROUTER_IP:80/rest/interface/wireguard
PUT http://ROUTER_IP:80/rest/interface/wireguard/peers
PUT http://ROUTER_IP:80/rest/ip/address
// Auth: Basic base64(user:pass), Content-Type: application/json
```

## File Map (critical paths)
```
backend/
  src/modules/routers/
    routers.service.ts        — create() returns wgProvision, generateWgProvision(), pollForTunnel()
    routers.controller.ts     — thin REST wrapper
    router-api.service.ts     — RouterOS API + circuit breaker (opossum)
    router-api.commands.ts    — RouterOS command helpers
  src/modules/provisioning/
    wireguard.utils.ts        — generateWireGuardKeyPair (Node crypto), wg peer management via nsenter
  prisma/schema.prisma        — Router model: wireguardIp null until tunnel up

mobile/
  app/(tabs)/routers.tsx      — THE router screen (NOT app/routers.tsx which is dead)
  app/(tabs)/_layout.tsx      — Tab navigation
  src/lib/api.ts              — API client, types incl. WgProvision
  src/components/ui.tsx       — Shared UI components

infrastructure/
  docker/docker-compose.prod.yml  — api: privileged:true, pid:host
  nginx/                          — Reverse proxy config
```

## Common Traps
1. **Two routers.tsx**: `app/routers.tsx` = dead. `app/(tabs)/routers.tsx` = real. Always edit the tabs one.
2. **Gradle cache**: JS changes require `gradlew :app:createBundleReleaseJsAndAssets --rerun-tasks` before `assembleRelease`.
3. **Build dir sync**: `C:/dev/mikroserver-mobile-build/` is the build dir (short path for Windows). Manually `cp` changed mobile files there before building.
4. **React Query timeout**: Never check `Date.now()` inside `useEffect([query.data])` — structural sharing keeps same reference. Use `setTimeout` in `useEffect([pendingId])` instead.
5. **Docker wg access**: Container needs `privileged: true + pid: host` to nsenter into host network namespace for `wg` commands.

## VPS Access
- IP: `139.84.241.27`
- SSH via plink: `plink -ssh -pw PASSWORD -batch root@139.84.241.27 CMD`
- Always `stty cols 220` first
- Deploy: `cd ~/mikroserver && git pull && docker compose -f infrastructure/docker/docker-compose.prod.yml up -d --build api`

## Payment Flow
Customer → `POST /payments/initiate` → Wave checkout URL → Wave webhook → BullMQ → voucher created → MikroTik hotspot user activated

## Security Model
- JWT global guard (opt-out with `@Public()`)
- Roles: SUPER_ADMIN > ADMIN > RESELLER > VIEWER
- Webhook: IP allowlist + HMAC `timingSafeEqual` + 5min replay window
- Argon2id: memory=65536, iterations=3, parallelism=4
- No cascade deletes — soft delete everywhere (`deletedAt`)
- Audit logs append-only