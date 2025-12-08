Write-Host ""
Write-Host "Stopping recording and demo..."

$obsPath = "C:\Program Files\obs-studio\bin\64bit\obs64.exe"

Start-Process `
  -FilePath $obsPath `
  -ArgumentList "--stoprecording" `
  -WindowStyle Minimized

Start-Sleep -Seconds 1

cd "$PSScriptRoot"
docker compose -f docker-compose.demo.yml down

Write-Host ""
Write-Host "======================================="
Write-Host "   RECORDING SAVED & DEMO STOPPED"
Write-Host "======================================="
Pause
