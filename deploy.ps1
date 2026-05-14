<# 
  JAABO - Deploy to Azure VM
  Run this PowerShell script from your Windows machine.
  It will push your code to GitHub, then SSH into the VM and deploy.
#>

$SERVER_IP = "135.171.216.245"
$SERVER_USER = "azureuser"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "        JAABO - Deploy to Azure VM" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# ----- Step 1: Push latest code to GitHub -----
Write-Host "[1/3] Pushing latest code to GitHub..." -ForegroundColor Yellow
Set-Location "E:\My_Github_Projects\Jaabo"

git add -A
git commit -m "Deploy: update for production" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  No new changes to commit (or already committed)." -ForegroundColor DarkYellow
}
git push origin main 2>$null
if ($LASTEXITCODE -ne 0) {
    git push origin master 2>$null
}
Write-Host "  Code pushed to GitHub." -ForegroundColor Green
Write-Host ""

# ----- Step 2: Copy setup script to VM -----
Write-Host "[2/3] Copying setup script to VM..." -ForegroundColor Yellow
Write-Host "  You will be prompted for the SSH password." -ForegroundColor DarkYellow
Write-Host ""
scp "E:\My_Github_Projects\Jaabo\setup_server.sh" "${SERVER_USER}@${SERVER_IP}:~/setup_server.sh"
Write-Host "  Setup script copied." -ForegroundColor Green
Write-Host ""

# ----- Step 3: SSH into VM and run setup -----
Write-Host "[3/3] SSHing into VM to run deployment..." -ForegroundColor Yellow
Write-Host "  You will be prompted for the SSH password again." -ForegroundColor DarkYellow
Write-Host ""
ssh "${SERVER_USER}@${SERVER_IP}" "chmod +x ~/setup_server.sh && bash ~/setup_server.sh"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Deployment process finished!" -ForegroundColor Cyan
Write-Host "  App URL:     http://${SERVER_IP}/DU_Vibecoders-busgo" -ForegroundColor Green
Write-Host "  API URL:     http://${SERVER_IP}/DU_Vibecoders-busgo/api" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
