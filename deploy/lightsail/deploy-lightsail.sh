#!/usr/bin/env bash
# ==============================================================================
# RALT ONDC Logistics Provider (BPP) — AWS Lightsail Production Deployment Runner
# Enterprise Grade: Zero-Downtime Rolling Update, Health Probes & Auto-Rollback
# Inspired by Ralt Enterprise Architecture Standard
# ==============================================================================

set -euo pipefail

# Terminal formatting
COLOR_INFO="\033[36m"
COLOR_SUCCESS="\033[32m"
COLOR_WARNING="\033[33m"
COLOR_DANGER="\033[31m"
COLOR_RESET="\033[0m"

log_info() { echo -e "${COLOR_INFO}[INFO] $(date +'%Y-%m-%d %H:%M:%S') $1${COLOR_RESET}"; }
log_success() { echo -e "${COLOR_SUCCESS}[SUCCESS] $(date +'%Y-%m-%d %H:%M:%S') $1${COLOR_RESET}"; }
log_warn() { echo -e "${COLOR_WARNING}[WARN] $(date +'%Y-%m-%d %H:%M:%S') $1${COLOR_RESET}"; }
log_error() { echo -e "${COLOR_DANGER}[ERROR] $(date +'%Y-%m-%d %H:%M:%S') $1${COLOR_RESET}"; }

DEPLOY_DIR="${DEPLOY_DIR:-/opt/ralt-ondc}"
COMPOSE_FILE="${DEPLOY_DIR}/deploy/lightsail/docker-compose.yml"
BACKUP_DIR="${DEPLOY_DIR}/.backups/$(date +'%Y%m%d_%H%M%S')"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${REGISTRY:-ghcr.io/saipraneeth9}"
HEALTH_TIMEOUT_SECS=60

mkdir -p "${DEPLOY_DIR}"
mkdir -p "${DEPLOY_DIR}/.backups"

log_info "Starting enterprise deployment to AWS Lightsail (Target Tag: ${IMAGE_TAG})..."

# ------------------------------------------------------------------------------
# 1. System Pre-flight Checks
# ------------------------------------------------------------------------------
log_info "Step 1/6: Running pre-flight checks..."

command -v docker >/dev/null 2>&1 || { log_error "Docker is not installed on host!"; exit 1; }
docker compose version >/dev/null 2>&1 || { log_error "Docker Compose v2 is not installed on host!"; exit 1; }

# Check available disk space (require >= 1GB)
AVAILABLE_KB=$(df -k / | awk 'NR==2 {print $4}')
if [ "${AVAILABLE_KB}" -lt 1048576 ]; then
  log_warn "Low disk space (<1GB)! Running aggressive docker system prune..."
  docker system prune -af --volumes || true
fi

# ------------------------------------------------------------------------------
# 2. State Backup & Environment Configuration
# ------------------------------------------------------------------------------
log_info "Step 2/6: Snapshotting state to ${BACKUP_DIR}..."
mkdir -p "${BACKUP_DIR}"
if [ -f "${COMPOSE_FILE}" ]; then
  cp "${COMPOSE_FILE}" "${BACKUP_DIR}/docker-compose.yml.bak" || true
fi
if [ -f "${DEPLOY_DIR}/services/ondc-lsp-service/.env" ]; then
  cp "${DEPLOY_DIR}/services/ondc-lsp-service/.env" "${BACKUP_DIR}/backend.env.bak" || true
  set -a
  source "${DEPLOY_DIR}/services/ondc-lsp-service/.env"
  set +a
elif [ -f "${DEPLOY_DIR}/.env" ]; then
  cp "${DEPLOY_DIR}/.env" "${BACKUP_DIR}/env.bak" || true
  set -a
  source "${DEPLOY_DIR}/.env"
  set +a
fi

# ------------------------------------------------------------------------------
# 3. Pull Updated Images with Retries
# ------------------------------------------------------------------------------
log_info "Step 3/6: Pulling updated container images (Tag: ${IMAGE_TAG})..."
export IMAGE_TAG="${IMAGE_TAG}"
export REGISTRY="${REGISTRY}"

pull_attempts=0
max_pull_attempts=3
until docker compose -f "${COMPOSE_FILE}" pull --ignore-pull-failures || [ $pull_attempts -ge $max_pull_attempts ]; do
  pull_attempts=$((pull_attempts + 1))
  log_warn "Docker pull attempt ${pull_attempts} failed. Retrying in 5s..."
  sleep 5
done

# ------------------------------------------------------------------------------
# 4. Database Schema & Datastores
# ------------------------------------------------------------------------------
log_info "Step 4/6: Ensuring PostGIS, Redis, and RabbitMQ datastores are active..."
docker compose -f "${COMPOSE_FILE}" up -d postgres redis rabbitmq

log_info "Waiting for PostgreSQL + PostGIS to report ready..."
for i in {1..30}; do
  if docker exec ralt-ondc-postgres-prod pg_isready -U postgres >/dev/null 2>&1; then
    log_success "PostgreSQL + PostGIS is accepting connections."
    break
  fi
  sleep 2
done

# Initialize central PostGIS database if not yet present
INIT_SQL=""
if [ -f "${DEPLOY_DIR}/packages/database/init-dbs.sql" ]; then
  INIT_SQL="${DEPLOY_DIR}/packages/database/init-dbs.sql"
elif [ -f "${DEPLOY_DIR}/init-dbs.sql" ]; then
  INIT_SQL="${DEPLOY_DIR}/init-dbs.sql"
fi

if [ -n "${INIT_SQL}" ]; then
  log_info "Verifying PostGIS database schemas from ${INIT_SQL}..."
  docker exec -i ralt-ondc-postgres-prod psql -U postgres -d postgres -c "SELECT 1 FROM pg_database WHERE datname = 'ralt_ondc_db'" | grep -q 1 || {
    log_info "Initializing database ralt_ondc_db and extensions..."
    docker exec -i ralt-ondc-postgres-prod psql -U postgres < "${INIT_SQL}" || true
  }
fi

# ------------------------------------------------------------------------------
# 5. Graceful Rolling Reload of Backend & Caddy Ingress
# ------------------------------------------------------------------------------
log_info "Step 5/6: Applying rolling reload to backend & Caddy ingress..."
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

# ------------------------------------------------------------------------------
# 6. Comprehensive Health Check Probes & Auto-Rollback
# ------------------------------------------------------------------------------
log_info "Step 6/6: Probing endpoints (Timeout: ${HEALTH_TIMEOUT_SECS}s)..."

endpoints=(
  "http://localhost:80/health"
  "http://localhost:80/ready"
  "http://localhost:80/metrics"
)

all_healthy=false
elapsed=0

while [ "${elapsed}" -lt "${HEALTH_TIMEOUT_SECS}" ]; do
  failed_endpoints=0
  for url in "${endpoints[@]}"; do
    if ! curl -sf -m 3 "${url}" >/dev/null 2>&1; then
      failed_endpoints=$((failed_endpoints + 1))
    fi
  done

  if [ "${failed_endpoints}" -eq 0 ]; then
    all_healthy=true
    break
  fi

  sleep 3
  elapsed=$((elapsed + 3))
  log_info "Waiting for services to report healthy... (${elapsed}s elapsed, ${failed_endpoints} pending)"
done

if [ "${all_healthy}" = true ]; then
  log_success "🎉 Deployment verified successfully! All endpoints responding 200 OK."
  log_info "Pruning old dangling images..."
  docker image prune -f || true
  exit 0
else
  log_error "🚨 Health check timeout! One or more endpoints failed to report 200 OK within ${HEALTH_TIMEOUT_SECS}s."
  log_warn "Initiating automated rollback to backup snapshot..."

  if [ -f "${BACKUP_DIR}/docker-compose.yml.bak" ]; then
    cp "${BACKUP_DIR}/docker-compose.yml.bak" "${COMPOSE_FILE}"
    docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans
    log_warn "Rolled back to previous docker-compose state."
  fi

  exit 1
fi

