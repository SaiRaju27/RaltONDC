#!/bin/bash
# ==============================================================================
# RALT ONDC Backend - AWS Lightsail Automated Host Provisioning & Deployment
# Replaces old PM2 setup with Enterprise Docker & PostGIS Container Stack
# ==============================================================================

set -euo pipefail

echo "=================================================================="
echo "🚀 Setting up RALT ONDC Platform on AWS Lightsail"
echo "=================================================================="

# 1. Update system packages & configure Swap memory (Crucial for PostGIS stability on Lightsail)
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl git apt-transport-https ca-certificates gnupg lsb-release

# Configure 2GB Swapfile if none exists (Prevents PostGIS / PostgreSQL Linux OOM-killer crashes)
if [ ! -f /swapfile ] && [ "$(swapon --show | wc -l)" -le 1 ]; then
    echo "🧠 Configuring 2GB Swapfile to protect PostgreSQL + PostGIS from memory exhaustion..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap active: $(free -h | grep -i swap)"
fi

# 2. Install Docker Engine & Compose v2 if missing
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker Engine & Docker Compose v2..."
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo usermod -aG docker "$USER"
fi

# 3. Create persistent deployment directory
DEPLOY_DIR="/opt/ralt-ondc"
sudo mkdir -p "$DEPLOY_DIR"
sudo chown -R "$USER:$USER" "$DEPLOY_DIR"

echo "✅ Host runtime ready: Docker $(docker --version)"

# 4. Trigger the enterprise deployment runner if present
if [ -f "deploy/lightsail/deploy-lightsail.sh" ]; then
    export DEPLOY_DIR="$DEPLOY_DIR"
    bash deploy/lightsail/deploy-lightsail.sh
elif [ -f "$DEPLOY_DIR/deploy/lightsail/deploy-lightsail.sh" ]; then
    bash "$DEPLOY_DIR/deploy/lightsail/deploy-lightsail.sh"
else
    echo "👉 Deployment files ready in $DEPLOY_DIR. Run: make lightsail-up"
fi
