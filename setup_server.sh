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

# ----- Step 0: Configure Swap Space -----
echo "[0/6] Configuring swap space to prevent memory starvation..."
if ! grep -q "swapfile" /etc/fstab; then
    echo "  Creating 4GB swap file..."
    sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
    echo "  Swap space configured successfully."
else
    echo "  Swap space already configured."
fi

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

# ----- Step 4: Configure System Nginx for Domain -----
echo "[4/5] Configuring system nginx for $DOMAIN..."

# Create nginx config for the domain
sudo tee /etc/nginx/sites-available/busgo > /dev/null << NGINX_CONF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:8083;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8085/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_CONF

# Enable the site if not already enabled
if [ ! -L /etc/nginx/sites-enabled/busgo ]; then
    sudo ln -s /etc/nginx/sites-available/busgo /etc/nginx/sites-enabled/
fi

# Remove default config if it's blocking
if [ -f /etc/nginx/sites-enabled/default ]; then
    sudo rm /etc/nginx/sites-enabled/default
fi

# Test and reload nginx
sudo nginx -t && sudo systemctl reload nginx || echo "Nginx reload failed or not installed, continuing anyway."
echo "  System nginx configured and reloaded."

# Configure HTTPS with Certbot
echo "[5/6] Securing with HTTPS..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email || true

# ----- Step 6: Build and Deploy -----
echo "[6/6] Building and deploying with Docker Compose..."
cd "$PROJECT_DIR/busgo/infrastructure"

# Build and start everything
sudo docker compose down || true
echo "Building frontend first to avoid network/CPU contention..."
sudo docker compose build frontend
echo "Building and starting all other services..."
sudo docker compose up --build -d

echo ""
echo "=================================================="
echo "  DEPLOYMENT COMPLETE!"
echo "  Frontend is running on port 8083 (proxied via Nginx)"
echo "  API Gateway (Kong) is running on port 8085 (proxied via Nginx)"
echo "  URL: https://${DOMAIN}"
echo "=================================================="
