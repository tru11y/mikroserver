# MikroServer — Strict Code Rules

> These rules are NON-NEGOTIABLE. Every AI agent and contributor must follow them.

## 1. Security

- **Never store plaintext passwords** — Argon2id only (`argon2` npm). Never bcrypt.
- **Never log passwords, keys, or tokens** — not even partially.
- **Webhook HMAC**: always `timingSafeEqual`, always check timestamp within 5min window.
- **JWT**: never decode without verifying signature. Always validate `exp`.
- **SQL**: only Prisma ORM — no raw SQL unless absolutely necessary, parameterized only.
- **No secrets in code or env files committed to git** — use `.env.production` (gitignored).
- **Rate limiting**: every public endpoint behind Throttler + Nginx zone.
- **Input validation**: DTOs with class-validator on every controller method. No trust on request body.
- **Audit log**: every CREATE/UPDATE/DELETE of business entities must call `auditService.log()`.

## 2. Performance

- **Never block the event loop**: all DB calls, crypto, and I/O must be `async/await`.
- **Fire-and-forget properly**: use `void fn().catch(err => logger.warn(...))` — never lose errors silently.
- **No N+1 queries**: use Prisma `include` or batch. Never query inside loops.
- **BullMQ for async work**: payments, voucher delivery, notifications — never inline in request handler.
- **Circuit breaker**: every external service (RouterOS, Wave API) must go through opossum circuit breaker.
- **React Query**: always set `refetchInterval` for live data. Use `staleTime` to avoid redundant fetches.
- **Mobile polling**: use `setTimeout` for hard timeouts, not `Date.now()` inside `useEffect([data])`.

## 3. Reliability

- **Idempotency**: BullMQ job ID = `voucher-{id}`. Webhook: store raw payload first (<5ms), process async.
- **No cascade deletes**: use soft delete (`deletedAt: DateTime?`) everywhere.
- **Provisioning failures must be graceful**: log warn + save partial state. Never throw and leave DB dirty.
- **Health checks**: every service must have `/health/live` and `/health/ready` endpoints.
- **Retry logic**: BullMQ jobs: `attempts: 3`, `backoff: { type: 'exponential', delay: 2000 }`.

## 4. Code Quality

- **TypeScript strict mode**: no `any`, no `as unknown as X` chains, no `@ts-ignore`.
- **No unused imports/variables**: TS compiler must be clean, no suppressions.
- **DTOs for everything**: request bodies, responses — explicit types, never raw `object`.
- **No magic numbers**: extract constants (`WG_SUBNET`, `WG_LISTEN_PORT`, etc.).
- **Single responsibility**: services own business logic. Controllers are thin (validate → call service → return).
- **Private methods**: internal helpers must be `private`. Never expose internals via public methods.

## 5. Mobile (React Native + Expo)

- **Always edit `app/(tabs)/routers.tsx`** — NOT `app/routers.tsx` (dead file).
- **After JS changes**: force rebundle with `gradlew :app:createBundleReleaseJsAndAssets --rerun-tasks`.
- **Manually sync** changed files to `C:/dev/mikroserver-mobile-build/` before building.
- **React Query timeouts**: use `setTimeout` in `useEffect([id])`, not data-dependent effects.
- **Cleartext HTTP**: `android:usesCleartextTraffic="true"` required for local router API calls.
- **Error states**: every mutation needs `onError` with user-visible message. Never silent failure.

## 6. Docker / Infra

- **api container**: must have `privileged: true + pid: host` for WireGuard `nsenter` access.
- **Never expose port 3000 externally** — Nginx proxies only. Port 3001 = dashboard only.
- **No secrets in docker-compose** — use `${ENV_VAR}` from `.env` file.
- **Build order**: always `--build api` when backend changes. `up -d` alone uses cached image.
- **WG peer add**: use `nsenter -t 1 -n -- wg set wg0 peer ...` from inside container.
- **Key generation**: use `crypto.generateKeyPairSync('x25519')` — NEVER `wg genkey` from Docker (unreliable).

## 7. Git / Workflow

- **Commit backend + mobile changes separately** with clear messages.
- **After every fix**: deploy backend (`git pull + docker compose up --build api`) before testing mobile.
- **APK install flow**: bundle → assemble → `adb install -r` → `adb shell am start`.
- **VPS SSH on Windows**: use `plink -ssh -pw PASS -batch root@HOST CMD`. Run `stty cols 220` first.

## 8. Forbidden Patterns

```ts
// ❌ Never
const { privateKey } = { privateKey: randomBytes(32).toString('base64'), publicKey: same }
useEffect(() => { if (Date.now() - start > 90000) timeout(); }, [query.data])
execAsync('wg genkey') // inside Docker without nsenter
await prisma.router.findMany(); // inside a loop
console.log(password)

// ✅ Always
generateKeyPairSync('x25519') // Node.js built-in, correct WireGuard keys
useEffect(() => { const t = setTimeout(onTimeout, 90000); return () => clearTimeout(t); }, [pendingId])
execAsync('nsenter -t 1 -n -- wg ...') // with privileged:true + pid:host
prisma.router.findMany({ include: { ... } }) // batch
logger.debug('router created', { routerId }) // no secrets
```