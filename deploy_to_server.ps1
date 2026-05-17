<# 
  JAABO - Automated Deployment to Azure VM
#>

$SERVER_IP = "135.171.216.245"
$SERVER_USER = "azureuser"
$DOMAIN = "busgo.farefin.com"
$PASSWORD = "bqaIJ#1xUU+2QdChsNrA1zN^"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "        JAABO - Deploy to $SERVER_IP" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Please note: SSH will prompt you for the password." -ForegroundColor Yellow
Write-Host "Please copy this password to your clipboard now: " -NoNewline
Write-Host $PASSWORD -ForegroundColor Green
Write-Host ""

# ----- Step 1: Push latest code to GitHub -----
Write-Host "[1/3] Pushing latest code to GitHub..." -ForegroundColor Yellow
Set-Location "E:\My_Github_Projects\Jaabo"

git add -A
git commit -m "Deploy: update ports to 8084-8090 and fix nginx" 2>$null
git push origin main 2>$null
Write-Host "  Code pushed to GitHub." -ForegroundColor Green
Write-Host ""

# ----- Step 2: Copy setup script to VM -----
Write-Host "[2/3] Copying setup script to VM..." -ForegroundColor Yellow
Write-Host "=> When prompted, paste the password: $PASSWORD" -ForegroundColor Cyan
scp "E:\My_Github_Projects\Jaabo\setup_server.sh" "${SERVER_USER}@${SERVER_IP}:~/setup_server.sh"
Write-Host "  Setup script copied." -ForegroundColor Green
Write-Host ""

# ----- Step 3: SSH into VM and run setup -----
Write-Host "[3/3] SSHing into VM to run deployment..." -ForegroundColor Yellow
Write-Host "=> When prompted, paste the password: $PASSWORD" -ForegroundColor Cyan
ssh "${SERVER_USER}@${SERVER_IP}" "chmod +x ~/setup_server.sh && bash ~/setup_server.sh"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Deployment process finished!" -ForegroundColor Cyan
Write-Host "  Frontend: http://$SERVER_IP:8084" -ForegroundColor Green
Write-Host "  API: http://$SERVER_IP:8085" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
