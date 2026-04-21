# Architecture Decision Records — MikroServer v2

## 1. Ktor 3.x over Spring Boot

Ktor is chosen for its coroutine-first design, minimal footprint (~30MB fat JAR vs ~80MB+ for Spring), and direct control over the server pipeline. MikroServer shells out to `wg`/`nsenter` and maintains long-lived TCP connections to RouterOS devices — both patterns benefit from structured concurrency without Spring's thread-pool-per-request model. Ktor's plugin system gives us explicit composition of middleware (auth, rate-limit, CORS) without annotation magic.

## 2. Exposed over jOOQ

Exposed is Kotlin-native, requires no code generation step, and its DSL maps 1:1 to SQL while the DAO layer provides convenience for simple CRUD. jOOQ's type-safe query generation is powerful but adds build complexity (codegen from live DB or Flyway migrations). For a modular monolith with ~10 tables and straightforward queries, Exposed's lighter footprint wins. Migrations remain in Flyway (raw SQL), not in Exposed's schema DSL.

## 3. Custom Redis Job Queue over Quartz / external queue

BullMQ-style semantics (delayed jobs, exponential backoff retries, DLQ) are implemented in ~200 lines on top of Lettuce coroutines. This avoids Quartz's heavyweight JDBC-backed scheduler and its 11+ tables. Redis is already required for caching/rate-state, so no new infrastructure. The queue is intentionally minimal — if MikroServer needs multi-consumer fan-out or complex routing, we'd migrate to a proper message broker.

## 4. kotlinx.serialization over Jackson

Jackson is the Java ecosystem default but requires runtime reflection and has Kotlin interop friction (null-safety, default values, data classes). kotlinx.serialization is compile-time, Kotlin-native, and produces smaller/faster codecs. The trade-off: no automatic serialization of arbitrary JVM types — every DTO needs `@Serializable`. This is acceptable and even desirable as an explicit API contract.

## 5. RS256 JWT over HS256

v1 used HS256 (shared secret). v2 upgrades to RS256 (asymmetric) so that verification can happen without the signing key — enabling future API gateway or edge verification without exposing the private key. The private key stays on the API server only; public key can be distributed freely.

## 6. Docker: `privileged: true` + `pid: host` (NOT `network_mode: host`)

The API container needs to execute `nsenter --target 1 --net --mount` to manage WireGuard peers on the host's network namespace. This requires `privileged` and `pid: host`. However, `network_mode: host` is avoided — it would bypass Docker's network isolation entirely and expose all container ports. Instead, we use standard Docker networking for inter-service communication (api↔postgres↔redis) and only enter the host namespace for WG operations via nsenter.

## 7. Konform for Validation

Konform provides a declarative, type-safe validation DSL for Kotlin data classes without annotation processing. Lighter than Valiktor (which is unmaintained) and more Kotlin-idiomatic than javax.validation/Jakarta.

## 8. Resilience4j over custom circuit breaker

Resilience4j is the de facto JVM circuit breaker library with first-class Kotlin support, metrics integration (Micrometer), and configurable sliding windows. Reimplementing this would be error-prone. Each router gets its own breaker instance to isolate failures — one flaky router doesn't block voucher generation on healthy routers.

## 9. BouncyCastle for X25519 Key Generation

The JVM's built-in `KeyPairGenerator` supports X25519 from JDK 11+, but BouncyCastle provides consistent encoding and is the standard choice for cryptographic operations in the Java ecosystem. It matches the key format expected by WireGuard (raw 32-byte keys, base64-encoded).

## 10. Modular Monolith (not Microservices)

At current scale (single VPS, <100 operators), a modular monolith with enforced package boundaries (ArchUnit) provides development velocity without distributed systems complexity. The hexagonal architecture ensures infrastructure concerns are isolated behind interfaces, making future extraction to separate services straightforward if needed.
