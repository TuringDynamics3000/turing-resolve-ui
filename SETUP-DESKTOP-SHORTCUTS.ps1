# ============================================
# RISK BRAIN — AUTOMATED DESKTOP SHORTCUT SETUP
# ============================================
# This script creates all Risk Brain desktop shortcuts automatically
# with the Turing Brain icon attached.
#
# USAGE:
#   1. Open PowerShell as Administrator
#   2. cd to your repo directory
#   3. Run: .\SETUP-DESKTOP-SHORTCUTS.ps1
#
# ============================================

$repoPath = $PSScriptRoot
$desktopPath = [Environment]::GetFolderPath("Desktop")
$iconPath = "$repoPath\risk-brain.ico"

Write-Host ""
Write-Host "============================================"
Write-Host "   RISK BRAIN DESKTOP SHORTCUT SETUP"
Write-Host "============================================"
Write-Host ""
Write-Host "Repository Path: $repoPath"
Write-Host "Desktop Path: $desktopPath"
Write-Host "Icon Path: $iconPath"
Write-Host ""

# Check if icon exists
if (!(Test-Path $iconPath)) {
    Write-Host "ERROR: risk-brain.ico not found at $iconPath" -ForegroundColor Red
    Write-Host "Please ensure you're running this script from the repository root." -ForegroundColor Red
    Pause
    exit 1
}

# ============================================
# SHORTCUT DEFINITIONS
# ============================================
$shortcuts = @(
    @{
        Name = "Risk Brain Demo"
        Target = "powershell.exe"
        Arguments = "-ExecutionPolicy Bypass -File `"$repoPath\RUN-DEMO.ps1`""
        Description = "Launch Risk Brain demo with cinematic boot sequence"
    },
    @{
        Name = "Risk Brain Demo (Recorded)"
        Target = "powershell.exe"
        Arguments = "-ExecutionPolicy Bypass -File `"$repoPath\RUN-DEMO-RECORDED.ps1`""
        Description = "Launch Risk Brain demo with automatic screen recording"
    },
    @{
        Name = "Risk Brain Crisis Mode"
        Target = "powershell.exe"
        Arguments = "-ExecutionPolicy Bypass -File `"$repoPath\CRISIS-MODE.ps1`""
        Description = "Switch Risk Brain to CRISIS mode (live)"
    },
    @{
        Name = "Risk Brain Stop Demo"
        Target = "powershell.exe"
        Arguments = "-ExecutionPolicy Bypass -File `"$repoPath\STOP-DEMO.ps1`""
        Description = "Stop Risk Brain demo stack"
    },
    @{
        Name = "Risk Brain Stop Recording"
        Target = "powershell.exe"
        Arguments = "-ExecutionPolicy Bypass -File `"$repoPath\STOP-DEMO-RECORDED.ps1`""
        Description = "Stop recording and demo stack"
    }
)

# ============================================
# CREATE SHORTCUTS
# ============================================
$WshShell = New-Object -ComObject WScript.Shell

foreach ($shortcut in $shortcuts) {
    $shortcutPath = "$desktopPath\$($shortcut.Name).lnk"
    
    Write-Host "Creating: $($shortcut.Name)..." -ForegroundColor Cyan
    
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = $shortcut.Target
    $Shortcut.Arguments = $shortcut.Arguments
    $Shortcut.WorkingDirectory = $repoPath
    $Shortcut.Description = $shortcut.Description
    $Shortcut.IconLocation = $iconPath
    $Shortcut.Save()
    
    Write-Host "  ✅ Created: $shortcutPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================"
Write-Host "   SETUP COMPLETE"
Write-Host "============================================"
Write-Host ""
Write-Host "Created $($shortcuts.Count) desktop shortcuts:" -ForegroundColor Green
Write-Host ""
foreach ($shortcut in $shortcuts) {
    Write-Host "  🟢 $($shortcut.Name)" -ForegroundColor Green
}
Write-Host ""
Write-Host "All shortcuts use the Turing Brain icon." -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Check your desktop for the new shortcuts"
Write-Host "  2. Double-click 'Risk Brain Demo' to test"
Write-Host "  3. Use 'Risk Brain Crisis Mode' during demos"
Write-Host "  4. Use 'Risk Brain Stop Demo' to clean up"
Write-Host ""
Write-Host "For demo recording (optional):" -ForegroundColor Yellow
Write-Host "  1. Install OBS Studio: https://obsproject.com/"
Write-Host "  2. Create scene: 'Risk Brain Demo'"
Write-Host "  3. Add Display Capture source"
Write-Host "  4. Use 'Risk Brain Demo (Recorded)' shortcut"
Write-Host ""
Pause
