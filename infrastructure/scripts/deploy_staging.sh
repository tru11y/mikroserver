#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f "infrastructure/environments/staging/.env" ]]; then
  echo "Missing infrastructure/environments/staging/.env"
  echo "Copy infrastructure/environments/staging/.env.example and fill secrets."
  exit 1
fi

set -a
source infrastructure/environments/staging/.env
set +a

docker compose \
  -f infrastructure/docker/docker-compose.prod.yml \
  -f infrastructure/docker/docker-compose.staging.yml \
  up -d --build
