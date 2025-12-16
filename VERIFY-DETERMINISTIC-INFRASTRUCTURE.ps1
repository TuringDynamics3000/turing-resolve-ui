# VERIFY-DETERMINISTIC-INFRASTRUCTURE.ps1
# Verification script for deterministic testing infrastructure
# Run this after pulling the changes to verify everything works

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Deterministic Infrastructure Verification" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"
$allPassed = $true

# Check if we're in the right directory
if (-not (Test-Path "twin-orchestrator\src")) {
    Write-Host "❌ ERROR: Must run from repository root" -ForegroundColor Red
    Write-Host "   Current directory: $(Get-Location)" -ForegroundColor Yellow
    Write-Host "   Expected: turingcore-cu-digital-twin\" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Repository root detected" -ForegroundColor Green
Write-Host ""

# Test 1: Check files exist
Write-Host "[1/5] Checking file structure..." -ForegroundColor Cyan
$requiredFiles = @(
    "twin-orchestrator\src\testdata\__init__.py",
    "twin-orchestrator\src\testdata\deterministic.py",
    "twin-orchestrator\src\testdata\README.md",
    "twin-orchestrator\src\replay_bus.py",
    "twin-orchestrator\src\golden.py"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file MISSING" -ForegroundColor Red
        $allPassed = $false
    }
}
Write-Host ""

# Test 2: Test deterministic data generation
Write-Host "[2/5] Testing deterministic data generation..." -ForegroundColor Cyan
try {
    $output = python twin-orchestrator\src\testdata\deterministic.py 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Deterministic data module works" -ForegroundColor Green
        Write-Host "     Generated accounts, transactions, members, loans" -ForegroundColor Gray
    } else {
        Write-Host "  ❌ Deterministic data module failed" -ForegroundColor Red
        Write-Host "     $output" -ForegroundColor Yellow
        $allPassed = $false
    }
} catch {
    Write-Host "  ❌ Failed to run deterministic module: $_" -ForegroundColor Red
    $allPassed = $false
}
Write-Host ""

# Test 3: Test golden snapshots
Write-Host "[3/5] Testing golden snapshot engine..." -ForegroundColor Cyan
try {
    $output = python twin-orchestrator\src\golden.py 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Golden snapshot engine works" -ForegroundColor Green
        Write-Host "     Created snapshot, detected drift, verified tolerance" -ForegroundColor Gray
    } else {
        Write-Host "  ❌ Golden snapshot engine failed" -ForegroundColor Red
        Write-Host "     $output" -ForegroundColor Yellow
        $allPassed = $false
    }
} catch {
    Write-Host "  ❌ Failed to run golden module: $_" -ForegroundColor Red
    $allPassed = $false
}
Write-Host ""

# Test 4: Test replay bus (record mode)
Write-Host "[4/5] Testing replay bus (record mode)..." -ForegroundColor Cyan
try {
    $env:REPLAY_MODE = "record"
    $env:REPLAY_FILE = "replays\test-verify.jsonl"
    $output = python twin-orchestrator\src\replay_bus.py 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Replay bus record mode works" -ForegroundColor Green
        Write-Host "     Events captured to replays\test-verify.jsonl" -ForegroundColor Gray
    } else {
        Write-Host "  ❌ Replay bus record mode failed" -ForegroundColor Red
        Write-Host "     $output" -ForegroundColor Yellow
        $allPassed = $false
    }
} catch {
    Write-Host "  ❌ Failed to run replay bus: $_" -ForegroundColor Red
    $allPassed = $false
}
Write-Host ""

# Test 5: Test replay bus (replay mode)
Write-Host "[5/5] Testing replay bus (replay mode)..." -ForegroundColor Cyan
try {
    $env:REPLAY_MODE = "replay"
    $env:REPLAY_FILE = "replays\test-verify.jsonl"
    $output = python twin-orchestrator\src\replay_bus.py 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Replay bus replay mode works" -ForegroundColor Green
        Write-Host "     Events replayed from replays\test-verify.jsonl" -ForegroundColor Gray
    } else {
        Write-Host "  ❌ Replay bus replay mode failed" -ForegroundColor Red
        Write-Host "     $output" -ForegroundColor Yellow
        $allPassed = $false
    }
} catch {
    Write-Host "  ❌ Failed to run replay bus: $_" -ForegroundColor Red
    $allPassed = $false
}
Write-Host ""

# Summary
Write-Host "=====================================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "  ✅ ALL TESTS PASSED" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Deterministic infrastructure is ready!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Read: twin-orchestrator\src\testdata\README.md" -ForegroundColor White
    Write-Host "  2. Wire into CLI: Integrate with cli.py" -ForegroundColor White
    Write-Host "  3. Add to CI: Golden baseline checks" -ForegroundColor White
    Write-Host "  4. Record baselines: Capture golden runs" -ForegroundColor White
} else {
    Write-Host "  ❌ SOME TESTS FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Please review errors above and fix issues." -ForegroundColor Yellow
}
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Cleanup
Remove-Item -Path "twin-orchestrator\src\replays\test-verify.jsonl" -ErrorAction SilentlyContinue
Remove-Item -Path "twin-orchestrator\src\golden\cu-digital-demo-*.json" -ErrorAction SilentlyContinue

exit $(if ($allPassed) { 0 } else { 1 })
