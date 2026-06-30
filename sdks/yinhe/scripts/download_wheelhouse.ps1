param(
    [switch]$AllowNetwork
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..\..")
$CurrentDir = (Resolve-Path ".").Path

if ($CurrentDir -ne $RepoRoot.Path) {
    throw "This script must be run from the TuiLM repository root: $($RepoRoot.Path)"
}

if (-not $AllowNetwork) {
    Write-Host "This script downloads packages from the network. Re-run with -AllowNetwork if you explicitly allow it."
    exit 1
}

$RuntimeDir = Join-Path $RepoRoot ".runtime\yinhe-wheelhouse"
$VenvDir = Join-Path $RuntimeDir ".venv"
$WheelhouseDir = Join-Path $RepoRoot "sdks\yinhe\vendor\wheelhouse"
$Dependencies = @(
    "pandas",
    "pydantic>=2.6.4",
    "numba>=0.65.0",
    "scipy>=1.15.1",
    "statsmodels>=0.11.0"
)

Write-Host "WARNING: This script downloads third-party dependency wheels from the network."
Write-Host "Target wheelhouse: $WheelhouseDir"
Write-Host "Runtime venv: $VenvDir"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $WheelhouseDir | Out-Null

if (-not (Test-Path -LiteralPath $VenvDir)) {
    python -m venv $VenvDir
}
else {
    Write-Host "Existing venv found, reusing: $VenvDir"
}

$ActivateScript = Join-Path $VenvDir "Scripts\Activate.ps1"
if (-not (Test-Path -LiteralPath $ActivateScript)) {
    throw "Missing venv activation script: $ActivateScript"
}

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
. $ActivateScript

$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
if (-not (Test-Path -LiteralPath $VenvPython)) {
    throw "Missing venv Python: $VenvPython"
}

Write-Host ""
Write-Host "Python environment:"
& $VenvPython -c "import platform, sys; print('Python:', sys.version.replace('\n', ' ')); print('Platform:', platform.platform()); print('Machine:', platform.machine())"
& $VenvPython -m pip --version

Write-Host ""
Write-Host "Downloading dependency wheels with python -m pip download..."
& $VenvPython -m pip download --only-binary=:all: -d $WheelhouseDir @Dependencies
if ($LASTEXITCODE -ne 0) {
    throw "pip download failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Wheelhouse files:"
Get-ChildItem -LiteralPath $WheelhouseDir -Filter "*.whl" | Sort-Object Name | Select-Object Name, Length, LastWriteTime

Write-Host ""
Write-Host "Reminder: Do not add .whl files to Git. Confirm with:"
Write-Host "  git status --short"
Write-Host "  git status --ignored --short sdks/yinhe/vendor/wheelhouse"
