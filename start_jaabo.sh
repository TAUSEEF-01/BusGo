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
echo "Backend is running on: http://localhost:8000"
echo "Kong API Gateway:      http://localhost:8000"
echo "Database:              localhost:5432"
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
