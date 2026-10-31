#!/bin/bash
# ==============================================================================
# RALT ONDC Backend - AWS Lightsail Automated Setup Script
# ==============================================================================

set -e

echo "=========================================="
echo "🚀 Setting up RALT ONDC Backend on Lightsail"
echo "=========================================="

# 1. Update system packages
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl git nginx certbot python3-certbot-nginx

# 2. Install Node.js 20.x LTS
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 3. Install PM2 process manager
sudo npm install -g pm2

# 4. Create App Directory
sudo mkdir -p /var/www/ralt-ondc
sudo chown -R $USER:$USER /var/www/ralt-ondc

echo "✅ Environment dependencies installed!"
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

