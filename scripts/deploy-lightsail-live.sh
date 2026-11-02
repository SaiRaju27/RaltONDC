#!/usr/bin/env bash
# ==============================================================================
# RALT ONDC AWS Lightsail Direct Deployment & Verification Script
# Production Target: /var/www/ralt-ondc (PM2 + Nginx with Let's Encrypt SSL)
# ==============================================================================
set -euo pipefail

LIGHTSAIL_IP="${LIGHTSAIL_IP:-16.4.145.231}"
KEY_PATH="${KEY_PATH:-$HOME/.ssh/lightsail_default.pem}"
TARGET_DIR="/var/www/ralt-ondc"

echo "=================================================================="
echo "🚀 DEPLOYING RALT ONDC TO AWS LIGHTSAIL (${LIGHTSAIL_IP})"
echo "=================================================================="

if [ ! -f "$KEY_PATH" ]; then
  echo "❌ Error: SSH key not found at $KEY_PATH"
  exit 1
fi

echo "➡️  [1/5] Building distribution packages locally..."
(cd services/ondc-lsp-service && npm run build)

echo "➡️  [2/5] Syncing backend and deploy hooks to Lightsail..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.gemini' \
  --exclude '.backups' \
  --exclude '.env' \
  --exclude 'data' \
  -e "ssh -i $KEY_PATH -o StrictHostKeyChecking=no" \
  ./services/ondc-lsp-service/ "ubuntu@${LIGHTSAIL_IP}:${TARGET_DIR}/"

rsync -avz \
  -e "ssh -i $KEY_PATH -o StrictHostKeyChecking=no" \
  ./deploy/ "ubuntu@${LIGHTSAIL_IP}:${TARGET_DIR}/deploy/"

echo "➡️  [3/5] Running CodeDeploy hooks on Lightsail (AfterInstall)..."
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "ubuntu@${LIGHTSAIL_IP}" "bash ${TARGET_DIR}/deploy/codedeploy/AfterInstall.sh"

echo "➡️  [4/5] Reloading service via PM2..."
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "ubuntu@${LIGHTSAIL_IP}" "bash ${TARGET_DIR}/deploy/codedeploy/ApplicationStart.sh"

echo "➡️  [5/5] Validating service health..."
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "ubuntu@${LIGHTSAIL_IP}" "bash ${TARGET_DIR}/deploy/codedeploy/ValidateService.sh"

echo "=================================================================="
echo "🎉 DEPLOYMENT TO AWS LIGHTSAIL COMPLETED SUCCESSFULLY!"
echo "🌐 Public Production Endpoint: https://ralt.in/health"
echo "=================================================================="

# Test live SSL endpoint
curl -s https://ralt.in/health | jq . || curl -s https://ralt.in/health
echo ""
