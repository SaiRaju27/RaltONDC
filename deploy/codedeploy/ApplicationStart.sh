#!/usr/bin/env bash
set -e

echo "[CodeDeploy] ApplicationStart hook triggered..."
TARGET_DIR="/var/www/ralt-ondc"
cd "$TARGET_DIR"

# Ensure PM2 process is stopped so port 5000 is reserved for Docker
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop ralt-ondc || true
  pm2 delete ralt-ondc || true
  pm2 save || true
fi

# Ensure supporting Docker containers (Redis & Postgres) are running
if command -v docker >/dev/null 2>&1; then
  if ! docker ps --format '{{.Names}}' | grep -q "^ralt-ondc-redis$"; then
    echo "[CodeDeploy] Starting Redis container..."
    docker start ralt-ondc-redis 2>/dev/null || \
      docker run -d --name ralt-ondc-redis --restart unless-stopped -p 127.0.0.1:6379:6379 redis:7-alpine
  fi

  if ! docker ps --format '{{.Names}}' | grep -q "^ralt-ondc-postgres$"; then
    echo "[CodeDeploy] Starting PostgreSQL PostGIS container..."
    docker start ralt-ondc-postgres 2>/dev/null || \
      docker run -d --name ralt-ondc-postgres --restart unless-stopped \
        -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ralt_ondc_db \
        -p 127.0.0.1:5432:5432 postgis/postgis:16-3.4-alpine
  fi

  # Build backend container image
  echo "[CodeDeploy] Building ralt-ondc-backend container image..."
  docker rm -f ralt-ondc-app 2>/dev/null || true
  docker build -t ralt-ondc-backend:latest -f Dockerfile .

  # Launch backend container mapping 127.0.0.1:5000:5000 (reverse proxied by host Nginx with SSL)
  echo "[CodeDeploy] Starting ralt-ondc-app container..."
  docker run -d \
    --name ralt-ondc-app \
    --restart unless-stopped \
    -p 127.0.0.1:5000:5000 \
    ralt-ondc-backend:latest
fi

echo "[CodeDeploy] ApplicationStart hook completed."
exit 0
