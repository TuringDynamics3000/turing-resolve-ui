# push-ci-workflow.ps1
# PowerShell script to manually push the CI workflow with proper permissions

Write-Host "=== Push CI Workflow to GitHub ===" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path ".git")) {
    Write-Host "ERROR: Not in a git repository. Please run this from the turingcore-cu-digital-twin directory." -ForegroundColor Red
    exit 1
}

# Check if workflow file exists
if (-not (Test-Path ".github/workflows/cu-digital-acceptance.yaml")) {
    Write-Host "ERROR: CI workflow file not found at .github/workflows/cu-digital-acceptance.yaml" -ForegroundColor Red
    exit 1
}

Write-Host "Found CI workflow file: .github/workflows/cu-digital-acceptance.yaml" -ForegroundColor Green
Write-Host ""

# Show git status
Write-Host "Current git status:" -ForegroundColor Yellow
git status --short
Write-Host ""

# Stage the workflow file
Write-Host "Staging workflow file..." -ForegroundColor Yellow
git add .github/workflows/cu-digital-acceptance.yaml

# Check if there are changes to commit
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "No changes to commit. Workflow may already be pushed." -ForegroundColor Yellow
    exit 0
}

# Commit
Write-Host "Committing workflow file..." -ForegroundColor Yellow
git commit -m "Add GitHub Actions CI workflow for CU-Digital acceptance tests

This workflow:
- Runs architecture compliance tests
- Runs steady-state acceptance (all PRs)
- Runs CPS 230 chaos pack (main branch only)
- Fails build if any invariant fails

Note: This commit requires workflow permissions to push."

# Push
Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "NOTE: You must have 'workflow' permissions to push this file." -ForegroundColor Cyan
Write-Host ""

git push

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== SUCCESS ===" -ForegroundColor Green
    Write-Host "CI workflow pushed successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "=== PUSH FAILED ===" -ForegroundColor Red
    Write-Host ""
    Write-Host "The push was rejected. This is likely because:" -ForegroundColor Yellow
    Write-Host "1. Your GitHub token/credentials don't have 'workflow' permissions" -ForegroundColor Yellow
    Write-Host "2. You're using a GitHub App that needs workflow scope" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Solutions:" -ForegroundColor Cyan
    Write-Host "- Use a Personal Access Token (PAT) with 'workflow' scope" -ForegroundColor White
    Write-Host "- Push from a different account with admin permissions" -ForegroundColor White
    Write-Host "- Manually create the workflow file via GitHub web UI" -ForegroundColor White
    Write-Host ""
    Write-Host "The workflow file is ready at:" -ForegroundColor Yellow
    Write-Host "  .github/workflows/cu-digital-acceptance.yaml" -ForegroundColor White
    exit 1
}
