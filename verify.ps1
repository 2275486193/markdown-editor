# Markdown Editor - Verification Script
# Usage: .\verify.ps1
# SOP L4: run before marking any task as completed

$ErrorActionPreference = "Continue"
$allPassed = $true

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Markdown Editor - Task Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# [1/5] TypeScript type check
Write-Host "`n[1/5] TypeScript type check (tsc --noEmit)..." -ForegroundColor Yellow
$tscResult = pnpm run typecheck 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  PASS: TypeScript type check" -ForegroundColor Green
} else {
    Write-Host "  FAIL: TypeScript type check" -ForegroundColor Red
    $tscResult | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
    $allPassed = $false
}

# [2/5] Unit tests
Write-Host "`n[2/5] Unit tests (vitest run)..." -ForegroundColor Yellow
$testResult = pnpm test 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  PASS: All tests passed" -ForegroundColor Green
} else {
    Write-Host "  FAIL: Tests failed" -ForegroundColor Red
    $testResult | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
    $allPassed = $false
}

# [3/5] feature_list.json format
Write-Host "`n[3/5] feature_list.json format check..." -ForegroundColor Yellow
try {
    $featureList = Get-Content "feature_list.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($featureList.features) {
        $count = @($featureList.features).Count
        Write-Host "  PASS: feature_list.json valid ($count features)" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: feature_list.json missing 'features' array" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  FAIL: feature_list.json JSON parse error: $_" -ForegroundColor Red
    $allPassed = $false
}

# [4/5] Forbidden patterns
Write-Host "`n[4/5] Forbidden patterns check..." -ForegroundColor Yellow
$srcFiles = Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx

$todoCount = 0
$onlyTestCount = 0

foreach ($file in $srcFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    if ($file.FullName -notmatch "__tests__" -and $content -match "//\s*TODO") {
        $todoCount++
        Write-Host "  WARN: TODO found in $($file.Name)" -ForegroundColor Yellow
    }
    if ($file.FullName -match "__tests__" -and $content -match "\.only\(") {
        $onlyTestCount++
        Write-Host "  FAIL: .only() found in $($file.Name)" -ForegroundColor Red
    }
}

if ($todoCount -eq 0) { Write-Host "  PASS: No // TODO comments" -ForegroundColor Green }
if ($onlyTestCount -eq 0) { Write-Host "  PASS: No .only() tests" -ForegroundColor Green }
if ($onlyTestCount -gt 0) { $allPassed = $false }

# [5/5] Harness file integrity
Write-Host "`n[5/5] Harness file integrity..." -ForegroundColor Yellow
$requiredFiles = @(
    "CLAUDE.md",
    "feature_list.json",
    "specs/modules/editor.md",
    "specs/modules/file-system.md",
    "specs/modules/ai-agent.md",
    "constraints/design-rules.md",
    "contracts/ipc/commands.md",
    "contracts/stores/editor.md",
    "contracts/stores/ai.md",
    "contracts/stores/ui.md",
    "contracts/stores/blocks.md",
    "logs/INDEX.md"
)

$missingCount = 0
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "  FAIL: Missing $file" -ForegroundColor Red
        $missingCount++
        $allPassed = $false
    }
}
if ($missingCount -eq 0) {
    Write-Host "  PASS: All $($requiredFiles.Count) harness files present" -ForegroundColor Green
}

# Result
Write-Host "`n========================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "  ALL CHECKS PASSED" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "  SOME CHECKS FAILED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "`nFix the issues above, then re-run: .\verify.ps1" -ForegroundColor Yellow
    exit 1
}
