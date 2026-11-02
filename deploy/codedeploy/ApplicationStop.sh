#!/usr/bin/env bash
set -e

echo "[CodeDeploy] ApplicationStop hook triggered..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop ralt-ondc || true
fi
echo "[CodeDeploy] ApplicationStop hook completed."
exit 0
