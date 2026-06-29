Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..\..")
Set-Location $RepoRoot

$RuntimeDir = Join-Path $RepoRoot ".runtime\yinhe-smoke"
$VenvDir = Join-Path $RuntimeDir ".venv"
$OutputFile = Join-Path $RuntimeDir "import-smoke-output.txt"
$TgwWheel = Join-Path $RepoRoot "sdks\yinhe\vendor\wheels\tgw-1.0.8.7-py3-none-any.whl"
$AmazingDataWheel = Join-Path $RepoRoot "sdks\yinhe\vendor\wheels\AmazingData-1.1.8-cp312-none-any.whl"
$SmokeScript = Join-Path $RepoRoot "sdks\yinhe\scripts\import_smoke_test.py"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
Set-Content -LiteralPath $OutputFile -Value "Yinhe SDK import smoke test run" -Encoding UTF8

function Write-Logged {
    param([AllowEmptyString()][string]$Message)
    Write-Output $Message
    Add-Content -LiteralPath $OutputFile -Value $Message -Encoding UTF8
}

function Invoke-LoggedNative {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )

    Write-Logged ""
    Write-Logged ("PS> " + $FilePath + " " + ($Arguments -join " "))
    & $FilePath @Arguments 2>&1 | ForEach-Object {
        $line = $_.ToString()
        Write-Output $line
        Add-Content -LiteralPath $OutputFile -Value $line -Encoding UTF8
    }
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Command failed with exit code ${exitCode}: ${FilePath} $($Arguments -join ' ')"
    }
}

Write-Logged "Repository root: $RepoRoot"
Write-Logged "Runtime directory: $RuntimeDir"
Write-Logged "Boundary: no network, no real login, no real market-data query, no real subscription, no real trading request."
Write-Logged "Pip upgrade is intentionally skipped to avoid network access."

if (-not (Test-Path -LiteralPath $TgwWheel)) {
    throw "Missing wheel: $TgwWheel"
}
if (-not (Test-Path -LiteralPath $AmazingDataWheel)) {
    throw "Missing wheel: $AmazingDataWheel"
}
if (-not (Test-Path -LiteralPath $SmokeScript)) {
    throw "Missing smoke test script: $SmokeScript"
}

if (-not (Test-Path -LiteralPath $VenvDir)) {
    Invoke-LoggedNative "python" "-m" "venv" $VenvDir
}
else {
    Write-Logged "Existing venv found, reusing: $VenvDir"
}

$ActivateScript = Join-Path $VenvDir "Scripts\Activate.ps1"
if (-not (Test-Path -LiteralPath $ActivateScript)) {
    throw "Missing venv activation script: $ActivateScript"
}

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
. $ActivateScript
Write-Logged "Activated venv: $VenvDir"

$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
if (-not (Test-Path -LiteralPath $VenvPython)) {
    throw "Missing venv Python: $VenvPython"
}

Invoke-LoggedNative $VenvPython "-m" "pip" "install" "--no-index" "--no-deps" $TgwWheel
Invoke-LoggedNative $VenvPython "-m" "pip" "install" "--no-index" "--no-deps" $AmazingDataWheel

Write-Logged ""
Write-Logged ("PS> " + $VenvPython + " " + $SmokeScript)
& $VenvPython $SmokeScript 2>&1 | ForEach-Object {
    $line = $_.ToString()
    Write-Output $line
    Add-Content -LiteralPath $OutputFile -Value $line -Encoding UTF8
}
$SmokeExitCode = $LASTEXITCODE

Write-Logged ""
Write-Logged "Smoke test exit code: $SmokeExitCode"
Write-Logged "Smoke test output saved to: $OutputFile"

exit $SmokeExitCode
