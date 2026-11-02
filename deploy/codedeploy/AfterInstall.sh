#!/usr/bin/env bash
set -e

echo "[CodeDeploy] AfterInstall hook triggered..."
TARGET_DIR="/var/www/ralt-ondc"
cd "$TARGET_DIR"

# Restore recent backup .env if not present
LATEST_BACKUP=$(ls -td /var/www/ralt-ondc-backups/* 2>/dev/null | head -1 || true)
if [ -n "$LATEST_BACKUP" ] && [ ! -f "$TARGET_DIR/.env" ] && [ -f "$LATEST_BACKUP/.env" ]; then
  cp "$LATEST_BACKUP/.env" "$TARGET_DIR/.env"
fi

# Build dist if not prebuilt
if [ ! -d "$TARGET_DIR/dist" ] || [ ! -f "$TARGET_DIR/dist/server.js" ]; then
  npm ci --include=dev
  npm run build
  npm prune --production
fi

chmod +x "$TARGET_DIR"/deploy/**/*.sh || true

echo "[CodeDeploy] AfterInstall hook completed."
exit 0
