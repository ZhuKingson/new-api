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

echo "[5/5] Building backend image with prebuilt frontend artifacts and starting service..."
if ! docker build -f Dockerfile.dev -t new-api-dev-full:local .; then
  echo "Build failed with BuildKit. Retrying once with classic builder (DOCKER_BUILDKIT=0)..."
  DOCKER_BUILDKIT=0 docker build -f Dockerfile.dev -t new-api-dev-full:local .
fi

docker compose -f docker-compose.dev.yml up -d new-api

echo
echo "Done. Backend is running in dev mode with reused DB volume (new-api_pg_data)."
echo "Frontend assets source: web/default/dist (prebuilt locally and committed)."
echo "Check status: docker compose -f docker-compose.dev.yml ps"
echo "View logs:    docker compose -f docker-compose.dev.yml logs -f new-api"
