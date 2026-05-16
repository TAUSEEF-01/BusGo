<# 
  JAABO - Start Services on Azure VM
  Run this PowerShell script from your Windows machine.
#>

$SERVER_IP = "135.171.216.245"
$SERVER_USER = "azureuser"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "        JAABO - Starting Services" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "SSHing into VM to start all containers..." -ForegroundColor Yellow
Write-Host "You will be prompted for the SSH password." -ForegroundColor DarkYellow
Write-Host ""

ssh "${SERVER_USER}@${SERVER_IP}" "cd ~/Jaabo/busgo/infrastructure && docker compose up -d"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  All services are now starting up." -ForegroundColor Green
Write-Host "  URL: http://busgo.farefin.com" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
