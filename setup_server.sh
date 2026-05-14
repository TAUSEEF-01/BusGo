#!/bin/bash
set -e

# ============================================================
#  JAABO - Server Setup & Deployment Script
#  Run this on the Ubuntu VM (Azure)
# ============================================================

SERVER_IP="135.171.216.245"
REPO_URL="https://github.com/TAUSEEF-01/Jaabo.git"
PROJECT_DIR="$HOME/Jaabo"

echo "=================================================="
echo "  JAABO - Server Setup & Deployment"
echo "=================================================="
echo ""

# ----- Step 1: Install Docker -----
echo "[1/5] Installing Docker..."
if command -v docker &> /dev/null; then
    echo "  Docker is already installed: $(docker --version)"
else
    echo "  Installing Docker Engine..."
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl gnupg

    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Add current user to docker group so we don't need sudo for docker
    sudo usermod -aG docker $USER
    echo "  Docker installed successfully!"
    echo ""
    echo "  !! IMPORTANT: You need to log out and log back in for docker group to take effect."
    echo "  !! After re-logging, run this script again. It will skip Docker install and continue."
    echo ""
    exit 0
fi

# ----- Step 2: Install Git -----
echo "[2/5] Checking Git..."
if ! command -v git &> /dev/null; then
    echo "  Installing Git..."
    sudo apt-get install -y git
fi
echo "  Git is ready: $(git --version)"

# ----- Step 3: Clone or Update the Repository -----
echo "[3/5] Getting project code..."
if [ -d "$PROJECT_DIR" ]; then
    echo "  Project directory exists. Pulling latest changes..."
    cd "$PROJECT_DIR"
    git pull origin main || git pull origin master || echo "  Warning: git pull failed, using existing code."
else
    echo "  Cloning repository..."
    git clone "$REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

# ----- Step 4: Update configs for production -----
echo "[4/5] Updating configuration for server deployment..."

# Update Kong CORS to allow the server IP
KONG_FILE="$PROJECT_DIR/busgo/infrastructure/kong/kong.yml"
if [ -f "$KONG_FILE" ]; then
    # Add server IP to CORS origins if not already present
    if ! grep -q "http://$SERVER_IP" "$KONG_FILE"; then
        echo "  Adding server IP to Kong CORS origins..."
        sed -i "/origins:/a\\        - http://$SERVER_IP\n        - http://$SERVER_IP:80" "$KONG_FILE"
    fi
    echo "  Kong CORS config updated."
fi

# ----- Step 5: Build and Deploy -----
echo "[5/5] Building and deploying with Docker Compose..."
cd "$PROJECT_DIR/busgo/infrastructure"

# Stop any existing containers
docker compose down 2>/dev/null || true

# Build and start everything
docker compose up --build -d

echo ""
echo "=================================================="
echo "  DEPLOYMENT COMPLETE!"
echo "=================================================="
echo ""
echo "  Frontend:     http://$SERVER_IP"
echo "  API Gateway:  http://$SERVER_IP:8000"
echo ""
echo "  Useful commands:"
echo "    docker compose ps          - See running containers"
echo "    docker compose logs -f     - Follow all logs"
echo "    docker compose logs -f auth-service  - Follow specific service"
echo "    docker compose down        - Stop everything"
echo "    docker compose up -d       - Start everything"
echo "=================================================="
