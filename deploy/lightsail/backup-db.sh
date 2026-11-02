#!/usr/bin/env bash
# ==============================================================================
# RALT ONDC — PostGIS Automated Database Backup Script
# Keeps the last 14 daily compressed SQL backups in /opt/ralt-ondc/.backups/db
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/ralt-ondc/.backups/db}"
CONTAINER_NAME="${CONTAINER_NAME:-ralt-ondc-postgres-prod}"
DB_NAME="${DB_NAME:-ralt_ondc_db}"
TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting PostGIS backup for ${DB_NAME}..."

# Execute pg_dump directly inside the healthy container and compress with gzip
docker exec "${CONTAINER_NAME}" pg_dump -U postgres "${DB_NAME}" | gzip > "${BACKUP_FILE}"

echo "[$(date)] Backup successfully created: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Prune backups older than 14 days
find "${BACKUP_DIR}" -type f -name "${DB_NAME}_*.sql.gz" -mtime +14 -delete
echo "[$(date)] Pruned backups older than 14 days."

