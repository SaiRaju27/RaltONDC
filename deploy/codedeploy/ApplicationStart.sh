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
  # Ensure dedicated Docker bridge network exists
  docker network create ralt-net 2>/dev/null || true

  if ! docker ps --format '{{.Names}}' | grep -q "^ralt-ondc-redis$"; then
    echo "[CodeDeploy] Starting Redis container..."
    docker start ralt-ondc-redis 2>/dev/null || \
      docker run -d --name ralt-ondc-redis --network ralt-net --restart unless-stopped -p 127.0.0.1:6379:6379 redis:7-alpine
  fi
  docker network connect ralt-net ralt-ondc-redis 2>/dev/null || true

  if ! docker ps --format '{{.Names}}' | grep -q "^ralt-ondc-postgres$"; then
    echo "[CodeDeploy] Starting PostgreSQL PostGIS container..."
    docker start ralt-ondc-postgres 2>/dev/null || \
      docker run -d --name ralt-ondc-postgres --network ralt-net --restart unless-stopped \
        -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ralt_ondc_db \
        -p 127.0.0.1:5432:5432 postgis/postgis:16-3.4-alpine
  fi
  docker network connect ralt-net ralt-ondc-postgres 2>/dev/null || true

  if ! docker ps --format '{{.Names}}' | grep -q "^ralt-ondc-rabbitmq$"; then
    echo "[CodeDeploy] Starting RabbitMQ container..."
    docker start ralt-ondc-rabbitmq 2>/dev/null || \
      docker run -d --name ralt-ondc-rabbitmq --network ralt-net --restart unless-stopped \
        -p 127.0.0.1:5672:5672 -p 127.0.0.1:15672:15672 \
        rabbitmq:3.13-management-alpine
  fi
  docker network connect ralt-net ralt-ondc-rabbitmq 2>/dev/null || true

  # Build backend container image
  echo "[CodeDeploy] Building ralt-ondc-backend container image..."
  docker rm -f ralt-ondc-app 2>/dev/null || true
  docker build -t ralt-ondc-backend:latest -f Dockerfile .

  # Launch backend container mapping 127.0.0.1:5000:5000 (reverse proxied by host Nginx with SSL)
  echo "[CodeDeploy] Starting ralt-ondc-app container with full PostgreSQL + Redis + RabbitMQ cluster networking..."
  docker run -d \
    --name ralt-ondc-app \
    --network ralt-net \
    --restart unless-stopped \
    -p 127.0.0.1:5000:5000 \
    -e POSTGRES_HOST=ralt-ondc-postgres \
    -e POSTGRES_PORT=5432 \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=ralt_ondc_db \
    -e REDIS_URL=redis://ralt-ondc-redis:6379 \
    -e RABBITMQ_URL=amqp://guest:guest@ralt-ondc-rabbitmq:5672 \
    ralt-ondc-backend:latest
fi

echo "[CodeDeploy] ApplicationStart hook completed."
exit 0
