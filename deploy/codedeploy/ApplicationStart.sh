#!/usr/bin/env bash
set -e

echo "[CodeDeploy] ApplicationStart hook triggered..."
TARGET_DIR="/var/www/ralt-ondc"
cd "$TARGET_DIR"

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe ralt-ondc >/dev/null 2>&1; then
    echo "[CodeDeploy] Reloading existing PM2 cluster process ralt-ondc..."
    pm2 reload ralt-ondc --update-env
  else
    echo "[CodeDeploy] Starting PM2 process ralt-ondc..."
    pm2 start dist/server.js --name ralt-ondc
  fi
  pm2 save || true
fi

echo "[CodeDeploy] ApplicationStart hook completed."
exit 0
