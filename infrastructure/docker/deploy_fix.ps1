# PowerShell script to deploy fix to VPS
Write-Host "=== DEPLOY FIX TO VPS ===" -ForegroundColor Cyan
Write-Host "This script will fix the authentication issue on the VPS`n" -ForegroundColor White

# 1. Vérifier la connexion SSH
Write-Host "1. Testing SSH connection..." -ForegroundColor Cyan
$sshTest = ssh root@139.84.241.27 "echo 'SSH connection OK' && date" 2>&1
Write-Host $sshTest -ForegroundColor Green

# 2. Copier le script de réparation
Write-Host "`n2. Copying fix script to VPS..." -ForegroundColor Cyan
$scpResult = scp final_fix_all.sh root@139.84.241.27:/tmp/final_fix_all.sh 2>&1
Write-Host "Copy result: $scpResult" -ForegroundColor Green

# 3. Donner les permissions d'exécution
Write-Host "`n3. Setting executable permissions..." -ForegroundColor Cyan
$chmodResult = ssh root@139.84.241.27 "chmod +x /tmp/final_fix_all.sh" 2>&1
Write-Host "Permissions set" -ForegroundColor Green

# 4. Exécuter le script de réparation
Write-Host "`n4. Running fix script on VPS (this may take a few minutes)..." -ForegroundColor Cyan
Write-Host "Check /tmp/fix.log on the VPS for detailed output" -ForegroundColor Yellow
$runResult = ssh root@139.84.241.27 "bash /tmp/final_fix_all.sh 2>&1 | tee /tmp/fix.log" 2>&1
Write-Host $runResult

# 5. Vérifier le résultat
Write-Host "`n5. Checking result..." -ForegroundColor Cyan
$healthCheck = ssh root@139.84.241.27 "curl -s http://localhost:3000/api/v1/health/live && echo '`nHealth check OK'" 2>&1
Write-Host "Health check: $healthCheck" -ForegroundColor Green

# 6. Test final de connexion
Write-Host "`n6. Final login test..." -ForegroundColor Cyan
$loginTest = ssh root@139.84.241.27 @"
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s -w '\nHTTP: %{http_code}\n'
"@ 2>&1

Write-Host "Login test result:" -ForegroundColor Yellow
Write-Host $loginTest

Write-Host "`n=== DEPLOYMENT COMPLETE ===" -ForegroundColor Green
Write-Host "If login fails, check the logs:" -ForegroundColor White
Write-Host "  ssh root@139.84.241.27 'docker logs docker-api-1 --tail 50'" -ForegroundColor Gray
Write-Host ""
Write-Host "Credentials:" -ForegroundColor Cyan
Write-Host "  Email: admin@mikroserver.com" -ForegroundColor White
Write-Host "  Password: 12345678" -ForegroundColor White
Write-Host "  Dashboard: http://139.84.241.27:3001" -ForegroundColor White
Write-Host "  API: http://139.84.241.27:3000" -ForegroundColor White