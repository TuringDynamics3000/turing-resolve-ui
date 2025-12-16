# setup-and-push-workflow.ps1
# Complete setup script for Windows to clone repo and push CI workflow

Write-Host "=== TuringCore CU Digital Twin - Setup and Push CI Workflow ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clone repository if not exists
$repoDir = "turingcore-cu-digital-twin"

if (Test-Path $repoDir) {
    Write-Host "Repository already exists at: $repoDir" -ForegroundColor Yellow
    Write-Host "Pulling latest changes..." -ForegroundColor Yellow
    Set-Location $repoDir
    git pull
} else {
    Write-Host "Cloning repository..." -ForegroundColor Yellow
    git clone https://github.com/TuringDynamics3000/turingcore-cu-digital-twin.git
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to clone repository" -ForegroundColor Red
        exit 1
    }
    
    Set-Location $repoDir
}

Write-Host ""
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# Step 2: Check if workflow file exists
if (-not (Test-Path ".github/workflows/cu-digital-acceptance.yaml")) {
    Write-Host "ERROR: CI workflow file not found" -ForegroundColor Red
    Write-Host "The workflow file should be at: .github/workflows/cu-digital-acceptance.yaml" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found CI workflow file" -ForegroundColor Green
Write-Host ""

# Step 3: Check git status
Write-Host "Checking git status..." -ForegroundColor Yellow
$status = git status --porcelain .github/workflows/cu-digital-acceptance.yaml

if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "Workflow file is already committed and pushed." -ForegroundColor Green
    Write-Host ""
    Write-Host "=== DONE ===" -ForegroundColor Green
    exit 0
}

# Step 4: Stage and commit
Write-Host "Staging workflow file..." -ForegroundColor Yellow
git add .github/workflows/cu-digital-acceptance.yaml

Write-Host "Committing workflow file..." -ForegroundColor Yellow
git commit -m "Add GitHub Actions CI workflow for CU-Digital acceptance tests

This workflow:
- Runs architecture compliance tests
- Runs steady-state acceptance (all PRs)
- Runs CPS 230 chaos pack (main branch only)
- Fails build if any invariant fails

Pushed manually with workflow permissions."

# Step 5: Push
Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "NOTE: You must have 'workflow' permissions to push this file." -ForegroundColor Cyan
Write-Host ""

git push

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== SUCCESS ===" -ForegroundColor Green
    Write-Host "CI workflow pushed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The workflow will now run on:" -ForegroundColor Cyan
    Write-Host "- Every push to main/master branch" -ForegroundColor White
    Write-Host "- Every pull request to main/master branch" -ForegroundColor White
    Write-Host ""
    Write-Host "View workflows at:" -ForegroundColor Cyan
    Write-Host "https://github.com/TuringDynamics3000/turingcore-cu-digital-twin/actions" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "=== PUSH FAILED ===" -ForegroundColor Red
    Write-Host ""
    Write-Host "The push was rejected. This is likely because:" -ForegroundColor Yellow
    Write-Host "1. Your GitHub token/credentials don't have 'workflow' permissions" -ForegroundColor Yellow
    Write-Host "2. You're using a GitHub App that needs workflow scope" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Solutions:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Option 1: Use Personal Access Token (PAT)" -ForegroundColor White
    Write-Host "  1. Go to: https://github.com/settings/tokens" -ForegroundColor Gray
    Write-Host "  2. Generate new token (classic)" -ForegroundColor Gray
    Write-Host "  3. Select scopes: repo + workflow" -ForegroundColor Gray
    Write-Host "  4. Copy the token" -ForegroundColor Gray
    Write-Host "  5. Run: git remote set-url origin https://YOUR_TOKEN@github.com/TuringDynamics3000/turingcore-cu-digital-twin.git" -ForegroundColor Gray
    Write-Host "  6. Run this script again" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2: Push from GitHub web UI" -ForegroundColor White
    Write-Host "  1. Go to: https://github.com/TuringDynamics3000/turingcore-cu-digital-twin" -ForegroundColor Gray
    Write-Host "  2. Navigate to: .github/workflows/" -ForegroundColor Gray
    Write-Host "  3. Click 'Add file' > 'Create new file'" -ForegroundColor Gray
    Write-Host "  4. Name it: cu-digital-acceptance.yaml" -ForegroundColor Gray
    Write-Host "  5. Copy content from local file: .github/workflows/cu-digital-acceptance.yaml" -ForegroundColor Gray
    Write-Host "  6. Commit directly to master branch" -ForegroundColor Gray
    Write-Host ""
    Write-Host "The workflow file is ready at:" -ForegroundColor Yellow
    Write-Host "  $(Get-Location)\.github\workflows\cu-digital-acceptance.yaml" -ForegroundColor White
    exit 1
}
