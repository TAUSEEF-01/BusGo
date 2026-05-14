#!/bin/bash
set -e

# ============================================================
#  JAABO - Server Setup & Deployment Script
#  Run this on the Ubuntu VM (Azure)
# ============================================================

SERVER_IP="135.171.216.245"
REPO_URL="https://github.com/TAUSEEF-01/Jaabo.git"
PROJECT_DIR="$HOME/Jaabo"
APP_PATH="DU_Vibecoders-busgo"

echo "=================================================="
echo "  JAABO - Server Setup & Deployment"
echo "=================================================="
echo ""

# ----- Step 1: Install Docker -----
echo "[1/6] Installing Docker..."
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

    # Add current user to docker group
    sudo usermod -aG docker $USER
    echo "  Docker installed successfully!"
    echo ""
    echo "  !! IMPORTANT: You need to log out and log back in for docker group to take effect."
    echo "  !! After re-logging, run this script again."
    echo ""
    exit 0
fi

# ----- Step 2: Install Git -----
echo "[2/6] Checking Git..."
if ! command -v git &> /dev/null; then
    echo "  Installing Git..."
    sudo apt-get install -y git
fi
echo "  Git is ready: $(git --version)"

# ----- Step 3: Clone or Update the Repository -----
echo "[3/6] Getting project code..."
if [ -d "$PROJECT_DIR" ]; then
    echo "  Project directory exists. Pulling latest changes..."
    cd "$PROJECT_DIR"
    git pull origin main || git pull origin master || echo "  Warning: git pull failed, using existing code."
else
    echo "  Cloning repository..."
    git clone "$REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

# ----- Step 4: Configure System Nginx as Reverse Proxy -----
echo "[4/6] Configuring system nginx reverse proxy..."

# Create nginx config for our app
sudo tee /etc/nginx/sites-available/$APP_PATH > /dev/null << 'NGINX_CONF'
# JAABO - Reverse proxy config
# Proxies /DU_Vibecoders-busgo to the Docker frontend container on port 3000
# Proxies /DU_Vibecoders-busgo/api to Kong API gateway on port 8000

# Frontend: proxy to Docker container
location /DU_Vibecoders-busgo/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# API: proxy to Kong gateway
location /DU_Vibecoders-busgo/api/ {
    proxy_pass http://127.0.0.1:8000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
NGINX_CONF

# Check if there's a main nginx config that uses include for sites
NGINX_MAIN="/etc/nginx/sites-enabled/default"
if [ -f "$NGINX_MAIN" ]; then
    # Check if our config is already included
    if ! grep -q "$APP_PATH" "$NGINX_MAIN"; then
        echo "  Adding our location blocks to the default nginx site..."
        # Insert our location blocks inside the existing server block (before the last closing brace)
        sudo sed -i "/^}/i\\    include /etc/nginx/sites-available/$APP_PATH;" "$NGINX_MAIN"
    fi
fi

# Test and reload nginx
sudo nginx -t && sudo systemctl reload nginx
echo "  System nginx configured and reloaded."

# ----- Step 5: Update Kong CORS for the server -----
echo "[5/6] Updating Kong CORS config..."
KONG_FILE="$PROJECT_DIR/busgo/infrastructure/kong/kong.yml"
if [ -f "$KONG_FILE" ]; then
    if ! grep -q "http://$SERVER_IP" "$KONG_FILE"; then
        echo "  Adding server IP to Kong CORS origins..."
        sed -i "/origins:/a\\        - http://$SERVER_IP\n        - http://$SERVER_IP:80" "$KONG_FILE"
    fi
    echo "  Kong CORS config updated."
fi

# ----- Step 6: Build and Deploy -----
echo "[6/6] Building and deploying with Docker Compose..."
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
echo "  Your app:     http://$SERVER_IP/$APP_PATH"
echo "  API Gateway:  http://$SERVER_IP/$APP_PATH/api"
echo ""
echo "  Useful commands:"
echo "    cd ~/Jaabo/busgo/infrastructure"
echo "    docker compose ps              - See running containers"
echo "    docker compose logs -f         - Follow all logs"
echo "    docker compose logs -f frontend  - Follow frontend logs"
echo "    docker compose down            - Stop everything"
echo "    docker compose up --build -d   - Rebuild and start"
echo "=================================================="
