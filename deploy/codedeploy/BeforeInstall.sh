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

# ==============================================================================
# Self-Provisioning: Ensure system prerequisites exist if instance is fresh
# ==============================================================================

# 1. Ensure Swap exists (prevents OOM on 512MB RAM Lightsail instances during build)
SWAP_TOTAL=$(free -m 2>/dev/null | awk '/^Swap:/ {print $2}' || echo "0")
if [ -z "$SWAP_TOTAL" ] || [ "$SWAP_TOTAL" -lt 1000 ]; then
  if [ ! -f /swapfile ]; then
    echo "[CodeDeploy] Provisioning 2GB swap space for memory resilience..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile || true
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab || true
  fi
fi

# 2. Ensure Docker engine is installed and running
if ! command -v docker >/dev/null 2>&1; then
  echo "[CodeDeploy] Docker not found. Automatically installing Docker engine..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo systemctl enable --now docker
  sudo usermod -aG docker ubuntu || true
fi

# 3. Ensure Nginx is installed and running
if ! command -v nginx >/dev/null 2>&1; then
  echo "[CodeDeploy] Nginx not found. Installing Nginx reverse proxy..."
  sudo apt-get update -qq && sudo apt-get install -y -qq nginx
  sudo systemctl enable --now nginx
fi

echo "[CodeDeploy] BeforeInstall hook completed."
exit 0
