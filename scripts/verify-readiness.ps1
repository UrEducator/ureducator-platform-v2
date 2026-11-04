<#
.SYNOPSIS
  Local readiness gate for the UrEducator 2.0 staging release. Windows PowerShell 5.1 and PowerShell 7 compatible.
  Makes NO cloud calls and changes nothing outside this repository folder.

.DESCRIPTION
  Runs, in order, and stops at the first failure:
    Node 24 check, Java check, clean npm install, lint, TypeScript, unit tests, static rules lint,
    Firestore rules tests on the LOCAL emulator (demo project, localhost only), staging web build, Functions bundle,
    bundle scan, Functions scan, staging config scan, and an independent text search for the production project id,
    the old project id and live Razorpay keys.

.PARAMETER WebApiKey
  The PUBLIC Firebase web API key of the staging web app (from: npx.cmd firebase apps:sdkconfig WEB <appId> --project ugc-mock-test-staging).
  It is public configuration, not a secret. Without it the web build is a verification build and the result is NOT READY.

.PARAMETER SkipInstall   Skip "npm ci" (use only if you just ran it). The gate still passes.
.PARAMETER SkipRules     Skip the emulator rules tests. The result is then always NOT READY.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-readiness.ps1 -WebApiKey "<public key>"
#>
[CmdletBinding()]
param(
  [string]$WebApiKey = '',
  [switch]$SkipInstall,
  [switch]$SkipRules
)

$ErrorActionPreference = 'Continue'   # native commands write progress to stderr; we check $LASTEXITCODE explicitly instead
Set-Location (Split-Path -Parent $PSScriptRoot)

$StagingProject = 'ugc-mock-test-staging'
$IsWindowsOs = ($env:OS -eq 'Windows_NT')
$Npm = if ($IsWindowsOs) { 'npm.cmd' } else { 'npm' }   # npm.cmd avoids PowerShell's "running scripts is disabled" error for npm.ps1
$Passed = New-Object System.Collections.ArrayList
$Gaps = New-Object System.Collections.ArrayList

function Fail([string]$Message) {
  Write-Host ""
  Write-Host "STOP: $Message" -ForegroundColor Red
  Write-Host "Nothing has been deployed. Fix the problem above, then run this script again." -ForegroundColor Red
  exit 1
}
function Step([string]$Name, [scriptblock]$Body) {
  Write-Host ""
  Write-Host "=== $Name" -ForegroundColor Cyan
  $global:LASTEXITCODE = 0
  & $Body
  if ($LASTEXITCODE -ne 0) { Fail "$Name failed (exit code $LASTEXITCODE)" }
  [void]$Passed.Add($Name)
}

Step 'Node.js 24 is installed' {
  $v = (& node --version) 2>&1 | Out-String
  $v = $v.Trim()
  Write-Host "node $v"
  if ($v -notmatch '^v24\.') { Write-Host "Node 24 is required (this repository pins it). Install Node 24 LTS from nodejs.org, open a NEW terminal, and try again." -ForegroundColor Red; $global:LASTEXITCODE = 1 }
}

Step 'npm is available' {
  & $Npm --version
}

if (-not $SkipRules) {
  Step 'Java 21 or newer is installed (needed only by the local Firestore emulator)' {
    if (-not (Get-Command java -ErrorAction SilentlyContinue)) { Write-Host "Java was not found. Install Eclipse Temurin JDK 21 or newer, open a NEW terminal, and try again." -ForegroundColor Red; $global:LASTEXITCODE = 1; return }
    $j = (& java -version 2>&1 | Out-String)
    Write-Host ($j.Trim() -split "`n")[0]
    $m = [regex]::Match($j, 'version "(\d+)')
    if (-not $m.Success -or [int]$m.Groups[1].Value -lt 21) { Write-Host "Java 21 or newer is required." -ForegroundColor Red; $global:LASTEXITCODE = 1 }
  }
}

if (-not $SkipInstall) {
  Step 'Clean install from the lockfile (npm ci)' { & $Npm ci }
} else {
  Write-Host "Skipping npm ci (-SkipInstall)." -ForegroundColor Yellow
}

Step 'Lint (zero errors, zero warnings)' { & $Npm run lint -- --max-warnings 0 }
Step 'TypeScript checks (all workspaces)' { & $Npm run typecheck }
Step 'Unit tests (shared + functions)' { & $Npm test }
Step 'Static rules lint (NOT a behavioural test)' { & $Npm run lint:rules }

if ($SkipRules) {
  [void]$Gaps.Add('Firestore rules were NOT tested on the emulator (-SkipRules)')
  Write-Host ""
  Write-Host "=== Firestore rules on the local emulator: SKIPPED. The result will be NOT READY." -ForegroundColor Yellow
} else {
  Step 'Firestore rules tests on the LOCAL emulator (demo project, localhost only)' { & $Npm run test:rules }
}

Step 'Build the staging web app and the Functions bundle' {
  foreach ($d in @('apps/web/out', 'apps/web/.next', 'dist/functions')) { if (Test-Path $d) { Remove-Item -Recurse -Force $d } }
  Remove-Item Env:NEXT_PUBLIC_BACKEND -ErrorAction SilentlyContinue   # the mock backend must never be selected
  $env:NEXT_PUBLIC_APP_ENV = 'staging'
  $env:NEXT_PUBLIC_FIREBASE_PROJECT_ID = $StagingProject
  $env:NEXT_PUBLIC_FIREBASE_APP_ID = '1:336521990930:web:8ebaa57a7ae7bcf9f019cb'
  $env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "$StagingProject.firebaseapp.com"
  $env:NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '336521990930'
  $env:NEXT_PUBLIC_FIREBASE_API_KEY = $WebApiKey
  & $Npm run build
  if ($LASTEXITCODE -eq 0) { & $Npm run prepare:deploy }
}
if ([string]::IsNullOrWhiteSpace($WebApiKey)) {
  [void]$Gaps.Add('The web build has no Firebase API key (verification build only; pass -WebApiKey for a deployable build)')
  Write-Host "NOTE: no -WebApiKey given, so this web build cannot sign anyone in. It is good for scanning only." -ForegroundColor Yellow
}

Step 'Bundle scan: web (no production id, no live Razorpay, no mock code, no answer-key names)' { & $Npm run verify:bundle }
Step 'Bundle scan: Functions (lib and dist/functions)' { & $Npm run verify:functions }
Step 'Staging configuration scan (project, region, payments off, AI off, App Check monitor, instances)' { & $Npm run verify:config }

Step 'Independent text search for the production project id, the old project id and live Razorpay keys' {
  $paths = @('apps/web/out', 'functions/lib', 'dist/functions') | Where-Object { Test-Path $_ }
  $hits = Get-ChildItem -Path $paths -Recurse -File -Force | Select-String -Pattern 'ugc-mock-test(?!-staging)', 'ur-educator', 'rzp_live_' -List
  if ($hits) {
    $hits | ForEach-Object { Write-Host ("FOUND in " + $_.Path) -ForegroundColor Red }
    $global:LASTEXITCODE = 1
  } else {
    Write-Host ("Searched " + ($paths -join ', ') + ": no matches.")
  }
}

Write-Host ""
Write-Host "-------------------------------------------------------------"
$Passed | ForEach-Object { Write-Host "PASS  $_" -ForegroundColor Green }
if ($Gaps.Count -gt 0) {
  Write-Host ""
  $Gaps | ForEach-Object { Write-Host "GAP   $_" -ForegroundColor Yellow }
  Write-Host ""
  Write-Host "RESULT: NOT READY TO DEPLOY. Every check above passed, but the gaps listed are required before deployment." -ForegroundColor Yellow
  exit 2
}
Write-Host ""
Write-Host "RESULT: READY. All local gates passed. Nothing has been deployed." -ForegroundColor Green
exit 0
