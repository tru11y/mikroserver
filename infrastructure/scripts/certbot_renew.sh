#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="infrastructure/docker/docker-compose.prod.yml"

docker compose -f "$COMPOSE_FILE" run --rm certbot
docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -s reload
