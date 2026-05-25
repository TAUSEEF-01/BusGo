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
echo Backend is running on: http://localhost:8085
echo Kong API Gateway:      http://localhost:8085
echo.
echo Swagger UI (direct access):
echo   Auth:          http://localhost:8101/docs
echo   Search:        http://localhost:8102/docs
echo   Inventory:     http://localhost:8103/docs
echo   Booking:       http://localhost:8104/docs
echo   Payment:       http://localhost:8105/docs
echo   Ticket:        http://localhost:8106/docs
echo   Notification:  http://localhost:8107/docs
echo   Cancellation:  http://localhost:8108/docs
echo   Operator:      http://localhost:8109/docs
echo   Deals:         http://localhost:8110/docs
echo   Admin:         http://localhost:8111/docs
echo   Audit:         http://localhost:8112/docs
echo.
echo Swagger UI (via Kong Gateway):
echo   Auth:          http://localhost:8085/api/auth/docs
echo   Booking:       http://localhost:8085/api/bookings/docs
echo   (same pattern for all services)
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
