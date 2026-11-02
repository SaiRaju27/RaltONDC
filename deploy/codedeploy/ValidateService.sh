#!/usr/bin/env bash
set -e

echo "[CodeDeploy] ValidateService hook triggered..."

for i in {1..20}; do
  if curl -s -f http://127.0.0.1:5000/health >/dev/null 2>&1; then
    echo "[CodeDeploy] ✅ Service is healthy and responding to /health on port 5000!"
    exit 0
  fi
  echo "[CodeDeploy] Waiting for backend to become ready (attempt $i/20)..."
  sleep 2
done

echo "[CodeDeploy] ❌ Health check timed out after 40s!"
docker logs ralt-ondc-app --tail 30 || pm2 logs ralt-ondc --lines 20 || true
exit 1
