# MikroServer — Architecture Decision Record (ADR)

## 1. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| API Framework | NestJS (Fastify) | Fastify is 35% faster than Express. NestJS provides DI, guards, pipes — essential for fintech. |
| Language | TypeScript strict mode | Eliminates entire classes of runtime errors. No `any`. |
| Database | PostgreSQL 16 | ACID transactions critical for payment/voucher atomicity. JSONB for flexible metadata. |
| ORM | Prisma | Type-safe DB access, migration management, schema-first. |
| Cache/Queue | Redis + BullMQ | BullMQ is production-grade, supports retry/backoff/deduplication. Redis for token invalidation. |
| Logging | Pino (nestjs-pino) | 5-10x faster than Winston. JSON structured logs for log aggregation. |
| Auth | JWT + Argon2id | Argon2id is OWASP-recommended for password hashing. JWT for stateless API auth. |

## 2. Payment Flow Architecture

```
Customer → Captive Portal → POST /transactions/initiate
    │
    ├── Create Transaction (PENDING)
    ├── Call Wave API → get payment URL
    ├── Update Transaction (PROCESSING)
    └── Return payment URL

Customer → Wave Pay → Completes payment

Wave → POST /webhooks/wave
    │
    ├── HMAC verification (timing-safe)
    ├── Replay attack check (5 min window)
    ├── Idempotency check (external event ID)
    ├── Store raw webhook (< 5ms, return 200)
    └── Enqueue to BullMQ

BullMQ Worker → WebhookProcessorWorker
    │
    ├── Parse payload
    ├── Update Transaction (COMPLETED)
    └── Generate Voucher → VoucherService

VoucherService
    │
    ├── Generate cryptographically secure code
    ├── Check collision
    └── Enqueue to voucher-delivery queue

BullMQ Worker → VoucherDeliveryWorker
    │
    ├── Circuit breaker check
    ├── RouterOS API call (via WireGuard)
    ├── Mark Voucher (DELIVERED)
    └── Retry with exponential backoff on failure
```

## 3. Security Architecture

### Authentication
- **JWT Access Token** (15 min): Short-lived, stateless verification
- **Refresh Token Rotation**: Each refresh issues a new pair. Old token revoked.
- **Token Family Detection**: Reuse of revoked refresh token = entire family revoked (theft detection)
- **Argon2id**: Memory-hard, timing-safe hashing (OWASP top recommendation)
- **Account lockout**: 5 failed attempts → 15 min lock

### Webhook Security (layered)
1. **IP Allowlist** (Nginx + middleware): Only Wave's known IPs
2. **HMAC-SHA256**: `timingSafeEqual` prevents timing oracle attacks
3. **Replay Prevention**: 5-minute timestamp window
4. **Idempotency**: External event ID deduplication in DB
5. **Rate Limiting**: Nginx + NestJS Throttler

### API Security
- **Helmet**: Security headers on all responses
- **Rate Limiting**: Global 100/min, auth 10/min, webhooks 200/min
- **Validation**: class-validator on all inputs, whitelist mode
- **No `any` TypeScript**: Prevents type confusion attacks
- **Redacted logging**: Passwords, tokens never logged

## 4. RouterOS Integration

### WireGuard Tunnel
- All MikroTik API traffic over encrypted WireGuard VPN (10.66.66.0/24)
- RouterOS API port (8728) NOT exposed to public internet
- VPS is WireGuard server, routers are peers

### Circuit Breaker (opossum)
- **Per-router breaker**: One offline router doesn't affect others
- **50% failure threshold**: Opens after >50% failures in window
- **30s reset**: Half-open state tests router recovery
- **Automatic router status update**: DB updated when breaker opens

### Delivery Guarantees
- BullMQ persists jobs in Redis — survives API restart
- 5 retry attempts with exponential backoff (5s, 10s, 20s, 40s, 80s)
- Circuit breaker prevents wasted retries when router is down
- Job ID = `voucher-{voucherId}` — no duplicate deliveries

## 5. Database Design

### No Cascade Deletes
Intentional. All deletes are soft (deletedAt). Audit trail is permanent.
Foreign key violations = programming error, not runtime behavior.

### UUID Everywhere
- No sequential IDs exposed to clients (IDOR prevention)
- PostgreSQL UUID v4 generated at DB level

### Pre-aggregated Snapshots
`revenue_snapshots` table stores daily rollups.
Dashboard KPIs use snapshots for historical data (fast), live data for today.

### Audit Log Design
- Separate table, append-only
- `AuditService` never throws — audit failure must not break operations
- Contains both `userId` (who was affected) and `auditedById` (who performed action)

## 6. Observability

### Structured Logging (Pino)
- JSON format in production
- Request ID propagated through all log entries
- Sensitive fields redacted (authorization, cookies, passwords)
- Slow queries (>100ms) logged as warnings

### Health Checks
- `/health/live`: Liveness probe (is process alive?)
- `/health/ready`: Readiness probe (can serve traffic?)
- `/health`: Full health check (DB, Redis, memory, disk)

### Metrics
- `/metrics/dashboard`: Real-time KPIs
- `/metrics/revenue-chart`: Time-series revenue data
- Daily snapshot cron for historical efficiency

## 7. Scalability Path (SaaS Evolution)

### Current (Single Operator)
Single PostgreSQL, single Redis, 2 API replicas

### Phase 2 (Multi-operator SaaS)
1. Add `organizationId` to all models (multi-tenancy)
2. Row-Level Security in PostgreSQL
3. Redis Cluster for queue isolation
4. Per-operator Wave webhook secrets
5. Subdomain routing per operator

### Phase 3 (Scale)
1. Read replicas for analytics queries
2. Separate analytics DB (TimescaleDB for time-series)
3. Message broker (NATS/Kafka) for event streaming
4. Kubernetes with HPA based on queue depth

## 8. Performance Targets

| Metric | Target | How Achieved |
|---|---|---|
| API response time | < 200ms p99 | Fastify, Prisma indexed queries, Redis cache |
| Webhook acknowledgment | < 50ms | Store-and-queue pattern, no blocking operations |
| Voucher delivery | < 30s | BullMQ immediate queue, WireGuard low-latency |
| Dashboard load | < 1s | Pre-aggregated snapshots, parallel DB queries |
| Monthly transactions | 100k+ | 2 API replicas, connection pooling, queue workers |
