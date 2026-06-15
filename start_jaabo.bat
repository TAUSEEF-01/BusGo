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

:: Set local environment overrides
set POSTGRES_PORT=18086
set REDIS_PORT=18087
set KAFKA_PORT=18088
set KONG_PORT=18085
set KONG_ADMIN_PORT=18089
set FRONTEND_PORT=18083
set VITE_API_BASE_URL=http://localhost:18085

set AUTH_SERVICE_PORT=8501
set SEARCH_SERVICE_PORT=8502
set INVENTORY_SERVICE_PORT=8503
set BOOKING_SERVICE_PORT=8504
set PAYMENT_SERVICE_PORT=8505
set TICKET_SERVICE_PORT=8506
set NOTIFICATION_SERVICE_PORT=8507
set CANCELLATION_SERVICE_PORT=8508
set OPERATOR_SERVICE_PORT=8509
set DEALS_SERVICE_PORT=8510
set ADMIN_SERVICE_PORT=8511
set AUDIT_SERVICE_PORT=8512
set BANK_SERVICE_PORT=8513

set DATABASE_URL_AUTH=postgresql+asyncpg://user:password@postgres:5432/postgres
set DATABASE_URL_SEARCH=postgresql+asyncpg://user:password@postgres:5432/postgres
set DATABASE_URL_INVENTORY=postgresql+asyncpg://user:password@postgres:5432/postgres
set DATABASE_URL_BOOKING=postgresql+asyncpg://user:password@postgres:5432/postgres
set DATABASE_URL_PAYMENT=postgresql+asyncpg://user:password@postgres:5432/postgres
set DATABASE_URL_TICKET=postgresql+asyncpg://user:password@postgres:5432/postgres
set DATABASE_URL_NOTIFICATION=postgresql://user:password@postgres:5432/postgres
set DATABASE_URL_CANCELLATION=postgresql://user:password@postgres:5432/postgres
set DATABASE_URL_OPERATOR=postgresql+asyncpg://user:password@postgres:5432/postgres
set DATABASE_URL_DEALS=postgresql://user:password@postgres:5432/postgres
set DATABASE_URL_ADMIN=postgresql://user:password@postgres:5432/postgres
set DATABASE_URL_AUDIT=postgresql://user:password@postgres:5432/postgres

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
echo Backend is running on: http://localhost:18085
echo Kong API Gateway:      http://localhost:18085
echo.
echo Swagger UI (direct access):
echo   Auth:          http://localhost:8501/docs
echo   Search:        http://localhost:8502/docs
echo   Inventory:     http://localhost:8503/docs
echo   Booking:       http://localhost:8504/docs
echo   Payment:       http://localhost:8505/docs
echo   Ticket:        http://localhost:8506/docs
echo   Notification:  http://localhost:8507/docs
echo   Cancellation:  http://localhost:8508/docs
echo   Operator:      http://localhost:8509/docs
echo   Deals:         http://localhost:8510/docs
echo   Admin:         http://localhost:8511/docs
echo   Audit:         http://localhost:8512/docs
echo   Bank:          http://localhost:8513/docs
echo.
echo Swagger UI (via Kong Gateway):
echo   Auth:          http://localhost:18085/api/auth/docs
echo   Booking:       http://localhost:18085/api/bookings/docs
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
