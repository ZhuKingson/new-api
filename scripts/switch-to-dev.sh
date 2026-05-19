#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/5] Stopping old production-style compose stack (preserving volumes)..."
docker compose -f docker-compose.yml down --remove-orphans

echo "[2/5] Stopping any old dev stack leftovers (preserving volumes)..."
docker compose -f docker-compose.dev.yml down --remove-orphans || true

echo "[3/5] Ensuring shared PostgreSQL volume exists..."
docker volume inspect new-api_pg_data >/dev/null 2>&1 || docker volume create new-api_pg_data >/dev/null

echo "[4/5] Starting PostgreSQL and Redis with reusable data volume..."
docker compose -f docker-compose.dev.yml up -d postgres redis

echo "[5/5] Rebuilding and starting backend from latest local code..."
# Prefer BuildKit, but some Docker/Buildx versions may fail with
# "no active session ... context deadline exceeded" when exporting image.
# In that case fallback to classic builder and retry once automatically.
if ! docker compose -f docker-compose.dev.yml up -d --build new-api; then
  echo "Build failed with BuildKit. Retrying once with classic builder (DOCKER_BUILDKIT=0)..."
  COMPOSE_DOCKER_CLI_BUILD=0 DOCKER_BUILDKIT=0 docker compose -f docker-compose.dev.yml up -d --build new-api
fi

echo
echo "Done. Backend is running in dev mode with reused DB volume (new-api_pg_data)."
echo "Check status: docker compose -f docker-compose.dev.yml ps"
echo "View logs:    docker compose -f docker-compose.dev.yml logs -f new-api"
