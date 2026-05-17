#!/bin/bash
set -e

# ============================================================
#  JAABO - Server Setup & Deployment Script (Domain Version)
#  Run this on the Ubuntu VM (Azure)
# ============================================================

SERVER_IP="135.171.216.245"
DOMAIN="busgo.farefin.com"
REPO_URL="https://github.com/TAUSEEF-01/Jaabo.git"
PROJECT_DIR="$HOME/Jaabo"

echo "=================================================="
echo "  JAABO - Server Setup & Deployment ($DOMAIN)"
echo "=================================================="
echo ""

# ----- Step 1: Install Docker -----
echo "[1/6] Installing Docker..."
if command -v docker &> /dev/null; then
    echo "  Docker is already installed."
else
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "  Docker installed. PLEASE LOG OUT AND LOG BACK IN, then run this script again."
    exit 0
fi

# ----- Step 2: Install Git -----
echo "[2/6] Checking Git..."
if ! command -v git &> /dev/null; then
    sudo apt-get install -y git
fi

# ----- Step 3: Clone or Update the Repository -----
echo "[3/6] Getting project code..."
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
    git fetch origin
    git reset --hard origin/main || git reset --hard origin/master
else
    git clone "$REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

# ----- Step 4: Build and Deploy -----
echo "[4/5] Building and deploying with Docker Compose..."
cd "$PROJECT_DIR/busgo/infrastructure"

# Build and start everything
sudo docker compose down || true
sudo docker compose up --build -d

echo ""
echo "=================================================="
echo "  DEPLOYMENT COMPLETE!"
echo "  Frontend is running on port 8084"
echo "  API Gateway (Kong) is running on port 8085"
echo "  URL: http://$DOMAIN:8084"
echo "=================================================="
