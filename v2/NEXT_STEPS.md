# Next Steps — Intentionally Deferred

## Must-Have Before Production

1. **RouterOS password encryption at rest** — The `api_password_enc` column currently stores plaintext. Implement AES-256-GCM encryption with a key from environment. Deferred because it requires a key management decision (env var vs. secrets manager).

2. **Wave production adapter** — Only the sandbox client exists. The `ProductionWaveClient` stub needs real Wave API credentials and integration testing against their sandbox environment. Deferred because credentials are not yet available.

3. **TLS certificates** — `nginx.conf` references Let's Encrypt paths but cert-manager/certbot setup is not included. In v1 this was manual certbot. Deferred because it's ops tooling, not application code.

4. **Seed data CLI** — The `V10` migration seeds demo data only if the DB is empty. A proper seed command (or admin API endpoint) for creating operators and initial super-admin users is needed.

5. **Testcontainers integration tests** — Unit tests with in-memory mocks are included. Full integration tests with Testcontainers (Postgres + Redis + mock RouterOS) are scaffolded but not implemented. Deferred to avoid blocking the initial scaffold.

## Should-Have Soon

6. **Outbox publisher** — The outbox table is populated but no publisher reads it. Implement a coroutine-based poller that reads unpublished events and forwards them (SSE, webhooks, or internal handlers).

7. **Voucher expiry scheduler** — A background job that marks ACTIVE vouchers as EXPIRED when `expires_at` passes, and optionally removes the hotspot user from RouterOS.

8. **Operator multi-tenancy API** — CRUD endpoints for operators, plans, users. Currently only routers and auth are exposed via REST.

9. **Structured error codes for mobile** — The `ErrorResponse` format works but mobile clients benefit from machine-readable error codes beyond the current `code` field.

10. **OpenTelemetry tracing** — Micrometer metrics are wired; OTel trace propagation (W3C trace-context headers) is not yet configured. Add `opentelemetry-ktor` instrumentation.

## Nice-to-Have / Future

11. **HA Postgres** — Single-node Postgres is a SPOF. Consider managed Postgres or Patroni for failover.

12. **Redis Sentinel/Cluster** — Single Redis node. If queue reliability becomes critical, add Sentinel.

13. **Kubernetes migration** — Docker Compose is sufficient for single-VPS MVP. K8s manifests deferred until multi-node is needed.

14. **Admin dashboard backend** — Metrics aggregation, operator management, system health dashboard API.

15. **SMS/notification integration** — Send voucher codes to customers via SMS (Orange CI, MTN CI APIs) after payment.

16. **Rate-limit by API key** — Current rate limiting is per-IP. Per-operator API key rate limiting would be fairer for multi-tenant usage.
