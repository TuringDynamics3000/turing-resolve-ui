Write-Host ""
Write-Host "======================================="
Write-Host "   RISK BRAIN — CINEMATIC DEMO BOOT"
Write-Host "======================================="
Write-Host ""

cd "$PSScriptRoot"

Write-Host "Starting all demo containers..."
docker compose -f docker-compose.demo.yml up -d

Start-Sleep -Seconds 2

Write-Host "Launching cinematic boot sequence..."
powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\DEMO-SPLASH.ps1"
