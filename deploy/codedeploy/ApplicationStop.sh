#!/usr/bin/env bash
set -e

echo "[CodeDeploy] ApplicationStop hook triggered..."
# Stop PM2 if running
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop ralt-ondc || true
  pm2 delete ralt-ondc || true
fi

# Stop existing backend container
if command -v docker >/dev/null 2>&1; then
  docker stop ralt-ondc-app || true
  docker rm ralt-ondc-app || true
fi

echo "[CodeDeploy] ApplicationStop hook completed."
exit 0
