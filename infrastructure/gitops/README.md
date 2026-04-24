# GitOps Baseline

This repository now supports a GitOps-style deploy flow:

- CI validates code (`.github/workflows/ci.yml`).
- Deploys are triggered from GitHub Actions (`.github/workflows/deploy.yml`).
- Runtime state is described by versioned compose files:
  - `infrastructure/docker/docker-compose.prod.yml`
  - `infrastructure/docker/docker-compose.staging.yml`

## Why this exists

Historically, operations relied on many ad-hoc scripts in `infrastructure/docker/`.
To reduce drift and operational risk, day-to-day commands are consolidated into:

- `infrastructure/scripts/ops.sh`
- `infrastructure/scripts/deploy_staging.sh`
- `infrastructure/scripts/certbot_renew.sh`

## Recommended operational entrypoints

```bash
# Production
bash infrastructure/scripts/ops.sh deploy:prod

# Staging
bash infrastructure/scripts/ops.sh deploy:staging

# TLS renewal
bash infrastructure/scripts/ops.sh certbot:renew
```

## Next migration step

Move one-off repair scripts from `infrastructure/docker/` into:

- versioned migration files (`backend/prisma/migrations`)
- repeatable operations scripts under `infrastructure/scripts`
- GitHub Actions workflows for audited execution
