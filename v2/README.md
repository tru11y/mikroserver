# MikroServer v2

WiFi monetization SaaS backend for MikroTik hotspot operators. Kotlin/Ktor rewrite of the NestJS v1 platform.

## Prerequisites

- JDK 21+
- Docker & Docker Compose
- WireGuard tools (`wg`, `wg-quick`) on the host

## Local Development

```bash
# 1. Start infrastructure
docker compose -f docker-compose.prod.yml up -d postgres redis

# 2. Generate RSA keys for JWT
mkdir -p keys
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem

# 3. Configure environment
cp .env.example .env
# Edit .env: set JWT_PRIVATE_KEY_PEM=keys/private.pem, JWT_PUBLIC_KEY_PEM=keys/public.pem

# 4. Run migrations + start server
make dev
```

The server starts on `http://localhost:8080`. Flyway migrations run automatically on startup.

## Environment Variables

See [.env.example](.env.example) for all required variables.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/auth/login` | No | Login, get access + refresh tokens |
| POST | `/v1/auth/refresh` | No | Rotate refresh token |
| GET | `/v1/routers` | JWT | List operator's routers |
| POST | `/v1/routers` | JWT (ADMIN+) | Onboard new router |
| POST | `/v1/webhooks/wave/{operatorId}/{routerId}` | HMAC | Wave payment webhook |
| GET | `/health` | No | Health check |
| GET | `/metrics` | IP-restricted | Prometheus metrics |

## Build & Test

```bash
make build      # Fat JAR
make test       # All tests
make lint       # ktlint + detekt
make docker-build  # Docker image
```

## Production Deployment

```bash
# On VPS
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

The API container runs with `privileged: true` and `pid: host` to manage WireGuard peers via `nsenter`. See [DECISIONS.md](DECISIONS.md) for rationale.

## Architecture

Modular monolith, hexagonal-ish:
- `domain/` — Entities, events, repository interfaces (no framework deps)
- `application/` — Use cases (one per file)
- `infrastructure/` — Exposed repos, Redis queue, RouterOS client, WireGuard controller
- `api/` — Ktor routes, DTOs, plugins, DI

Package boundaries enforced by ArchUnit tests. See [DECISIONS.md](DECISIONS.md) for stack choices.
