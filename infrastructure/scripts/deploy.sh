#!/bin/bash
# =============================================================================
# MikroServer Production Deployment Script
# Usage: ./deploy.sh [--no-migrate]
# =============================================================================

set -euo pipefail

COMPOSE_FILE="./docker/docker-compose.prod.yml"
ENV_FILE="./docker/.env.prod"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
error() { echo "[ERROR] $*" >&2; exit 1; }

# Check prerequisites
command -v docker >/dev/null || error "Docker not installed"
command -v docker compose >/dev/null || error "Docker Compose not installed"
[[ -f "$ENV_FILE" ]] || error "Missing $ENV_FILE — copy from .env.example"

log "Starting MikroServer deployment..."

# Pull latest images
log "Pulling base images..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull --quiet

# Run database migrations (unless --no-migrate)
if [[ "${1:-}" != "--no-migrate" ]]; then
    log "Running database migrations..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm db-migrate
    log "Migrations complete"
fi

# Deploy with zero-downtime rolling update
log "Deploying services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d \
    --remove-orphans \
    --no-deps

# Health check
log "Waiting for API health check..."
MAX_ATTEMPTS=30
for i in $(seq 1 $MAX_ATTEMPTS); do
    if docker compose -f "$COMPOSE_FILE" exec -T api \
        curl -sf http://localhost:3000/api/v1/health/live > /dev/null 2>&1; then
        log "API is healthy!"
        break
    fi
    if [[ $i -eq $MAX_ATTEMPTS ]]; then
        error "API failed to become healthy after ${MAX_ATTEMPTS} attempts"
    fi
    log "Attempt $i/$MAX_ATTEMPTS — waiting..."
    sleep 5
done

# Cleanup old images
log "Cleaning up old Docker images..."
docker image prune -f --filter "until=24h"

log "Deployment complete!"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
