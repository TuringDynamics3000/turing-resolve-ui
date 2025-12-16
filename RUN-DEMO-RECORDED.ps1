$obsPath = "C:\Program Files\obs-studio\bin\64bit\obs64.exe"
$recordingsPath = "$PSScriptRoot\recordings"

if (!(Test-Path $recordingsPath)) {
  New-Item -ItemType Directory -Path $recordingsPath | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$videoFile = "$recordingsPath\RiskBrain-Demo-$timestamp.mp4"

Write-Host ""
Write-Host "======================================="
Write-Host "   RISK BRAIN — CINEMATIC DEMO RECORDER"
Write-Host "======================================="
Write-Host ""

Write-Host "Starting OBS headless recorder..."
Start-Process `
  -FilePath $obsPath `
  -ArgumentList "--startrecording --scene `"Risk Brain Demo`" --minimize-to-tray --recording-file `"$videoFile`"" `
  -WindowStyle Minimized

Start-Sleep -Seconds 3

Write-Host "Starting full demo stack..."
docker compose -f docker-compose.demo.yml up -d

Start-Sleep -Seconds 2

Write-Host "Launching cinematic boot..."
powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\DEMO-SPLASH.ps1"

Write-Host ""
Write-Host "======================================="
Write-Host "   RECORDING IN PROGRESS"
Write-Host "======================================="
Write-Host ""
Write-Host "Recording to:"
Write-Host $videoFile
Write-Host ""

Pause
