@echo off
setlocal EnableDelayedExpansion

echo ==================================================
echo         JAABO - Bus Reservation System
echo ==================================================

echo.
echo [1] Checking Docker installation...
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in the PATH.
    echo Please install Docker Desktop: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [2] Checking if Docker daemon is running...
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo.
echo [3] Starting Backend Services via Docker Compose...
cd busgo\infrastructure
echo Building and starting containers (this may take a moment)...
docker-compose up --build -d
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start backend services.
    pause
    exit /b 1
)
cd ..\..

echo.
echo [4] Starting Frontend Web App...
cd busgo\frontend
echo Checking/Installing frontend dependencies...
call npm install

echo.
echo ==================================================
echo Backend is running on: http://localhost:8000
echo Kong API Gateway:      http://localhost:8000
echo Database:              localhost:5432
echo.
echo The frontend will now start and automatically open
echo your default web browser to http://localhost:5173
echo ==================================================
echo.

:: Open the browser immediately before the blocking npm run dev call
start "" "http://localhost:5173"

:: Run the dev server
echo Starting Vite Dev Server...
call npm run dev

pause
endlocal
