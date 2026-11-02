#!/usr/bin/env bash
set -e

echo "[CodeDeploy] BeforeInstall hook triggered..."
TARGET_DIR="/var/www/ralt-ondc"
BACKUP_DIR="/var/www/ralt-ondc-backups/$(date +'%Y%m%d_%H%M%S')"

mkdir -p "$TARGET_DIR"
mkdir -p "$BACKUP_DIR"

if [ -f "$TARGET_DIR/.env" ]; then
  cp "$TARGET_DIR/.env" "$BACKUP_DIR/.env" || true
fi
if [ -d "$TARGET_DIR/data" ]; then
  cp -r "$TARGET_DIR/data" "$BACKUP_DIR/data" || true
fi

echo "[CodeDeploy] BeforeInstall hook completed."
exit 0
