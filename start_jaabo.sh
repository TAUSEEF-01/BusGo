#!/bin/bash
set -e

echo "=================================================="
echo "        JAABO - Bus Reservation System"
echo "=================================================="
echo

echo "[1] Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed or not in the PATH."
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "[2] Checking if Docker daemon is running..."
if ! docker info > /dev/null 2>&1; then
    echo "[ERROR] Docker is not running. Please start Docker and try again."
    exit 1
fi

echo
echo "[3] Starting Backend Services via Docker Compose..."

# Set local environment overrides
export POSTGRES_PORT=18086
export REDIS_PORT=18087
export KAFKA_PORT=18088
export KONG_PORT=18085
export KONG_ADMIN_PORT=18089
export FRONTEND_PORT=18083
export VITE_API_BASE_URL=http://localhost:18085

export AUTH_SERVICE_PORT=8501
export SEARCH_SERVICE_PORT=8502
export INVENTORY_SERVICE_PORT=8503
export BOOKING_SERVICE_PORT=8504
export PAYMENT_SERVICE_PORT=8505
export TICKET_SERVICE_PORT=8506
export NOTIFICATION_SERVICE_PORT=8507
export CANCELLATION_SERVICE_PORT=8508
export OPERATOR_SERVICE_PORT=8509
export DEALS_SERVICE_PORT=8510
export ADMIN_SERVICE_PORT=8511
export AUDIT_SERVICE_PORT=8512

export DATABASE_URL_AUTH=postgresql+asyncpg://user:password@postgres:5432/postgres
export DATABASE_URL_SEARCH=postgresql+asyncpg://user:password@postgres:5432/postgres
export DATABASE_URL_INVENTORY=postgresql+asyncpg://user:password@postgres:5432/postgres
export DATABASE_URL_BOOKING=postgresql+asyncpg://user:password@postgres:5432/postgres
export DATABASE_URL_PAYMENT=postgresql+asyncpg://user:password@postgres:5432/postgres
export DATABASE_URL_TICKET=postgresql+asyncpg://user:password@postgres:5432/postgres
export DATABASE_URL_NOTIFICATION=postgresql://user:password@postgres:5432/postgres
export DATABASE_URL_CANCELLATION=postgresql://user:password@postgres:5432/postgres
export DATABASE_URL_OPERATOR=postgresql+asyncpg://user:password@postgres:5432/postgres
export DATABASE_URL_DEALS=postgresql://user:password@postgres:5432/postgres
export DATABASE_URL_ADMIN=postgresql://user:password@postgres:5432/postgres
export DATABASE_URL_AUDIT=postgresql://user:password@postgres:5432/postgres

cd busgo/infrastructure
echo "Building and starting containers (this may take a moment)..."
docker compose up --build -d
cd ../..

echo
echo "[4] Starting Frontend Web App..."
cd busgo/frontend
echo "Checking/Installing frontend dependencies..."
npm install

echo
echo "=================================================="
echo "Backend is running on: http://localhost:18085"
echo "Kong API Gateway:      http://localhost:18085"
echo
echo "Swagger UI (direct access):"
echo "   Auth:          http://localhost:8501/docs"
echo "   Search:        http://localhost:8502/docs"
echo "   Inventory:     http://localhost:8503/docs"
echo "   Booking:       http://localhost:8504/docs"
echo "   Payment:       http://localhost:8505/docs"
echo "   Ticket:        http://localhost:8506/docs"
echo "   Notification:  http://localhost:8507/docs"
echo "   Cancellation:  http://localhost:8508/docs"
echo "   Operator:      http://localhost:8509/docs"
echo "   Deals:         http://localhost:8510/docs"
echo "   Admin:         http://localhost:8511/docs"
echo "   Audit:         http://localhost:8512/docs"
echo
echo "Swagger UI (via Kong Gateway):"
echo "   Auth:          http://localhost:18085/api/auth/docs"
echo "   Booking:       http://localhost:18085/api/bookings/docs"
echo "   (same pattern for all services)"
echo
echo "The frontend will now start and automatically open"
echo "your default web browser to http://localhost:5173"
echo "=================================================="
echo

# Try to open the browser based on the OS
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:5173" &
elif command -v open &> /dev/null; then
    open "http://localhost:5173" &
fi

# Run the dev server
echo "Starting Vite Dev Server..."
npm run dev
