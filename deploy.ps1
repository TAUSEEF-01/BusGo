<# 
  JAABO - Deploy to Azure VM (Domain Version)
  Run this PowerShell script from your Windows machine.
#>

$SERVER_IP = "135.171.216.245"
$SERVER_USER = "azureuser"
$DOMAIN = "busgo.farefin.com"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "        JAABO - Deploy to $DOMAIN" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# ----- Step 1: Push latest code to GitHub -----
Write-Host "[1/3] Pushing latest code to GitHub..." -ForegroundColor Yellow
Set-Location "E:\My_Github_Projects\Jaabo"

git add -A
git commit -m "Deploy: support domain busgo.farefin.com" 2>$null
git push origin main 2>$null
Write-Host "  Code pushed to GitHub." -ForegroundColor Green
Write-Host ""

# ----- Step 2: Copy setup script to VM -----
Write-Host "[2/3] Copying setup script to VM..." -ForegroundColor Yellow
scp "E:\My_Github_Projects\Jaabo\setup_server.sh" "${SERVER_USER}@${SERVER_IP}:~/setup_server.sh"
Write-Host "  Setup script copied." -ForegroundColor Green
Write-Host ""

# ----- Step 3: SSH into VM and run setup -----
Write-Host "[3/3] SSHing into VM to run deployment..." -ForegroundColor Yellow
ssh "${SERVER_USER}@${SERVER_IP}" "chmod +x ~/setup_server.sh && bash ~/setup_server.sh"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Deployment process finished!" -ForegroundColor Cyan
Write-Host "  URL: http://$DOMAIN" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
