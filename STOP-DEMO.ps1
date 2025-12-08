Write-Host ""
Write-Host "Stopping Risk Brain Demo Stack..."
Write-Host ""

cd "$PSScriptRoot"
docker compose -f docker-compose.demo.yml down

Write-Host ""
Write-Host "Demo fully stopped."
Pause
