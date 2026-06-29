param(
  [switch]$OpenDevTools
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$miniRoot = Join-Path $repoRoot "wechat-miniapp"

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "== $Name =="
  & $Command
}

function Assert-NativeSuccess {
  param(
    [string]$Name
  )

  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

function Find-WeChatDevToolsCli {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\微信开发者工具\cli.bat"),
    (Join-Path $env:LOCALAPPDATA "Programs\wechat-devtools\cli.bat"),
    "C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat",
    "C:\Program Files\Tencent\微信web开发者工具\cli.bat"
  )

  $fromPath = Get-Command cli -ErrorAction SilentlyContinue
  if ($fromPath) {
    return $fromPath.Source
  }

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

Push-Location $repoRoot
try {
  Invoke-Step "Miniapp static validation" {
    node scripts\validate-miniapp.js
    Assert-NativeSuccess "Miniapp static validation"
  }

  Invoke-Step "Automated tests" {
    $testFiles = rg --files tests | Where-Object { $_ -like "*.test.js" } | Sort-Object
    Assert-NativeSuccess "Test file discovery"
    node --test @testFiles
    Assert-NativeSuccess "Automated tests"
  }

  Invoke-Step "Miniapp JS syntax" {
    $files = rg --files wechat-miniapp | Where-Object { $_ -like "*.js" }
    foreach ($file in $files) {
      node --check $file
      Assert-NativeSuccess "JS syntax check for $file"
    }
    Write-Host "checked $($files.Count) js files"
  }

  Invoke-Step "Quote service JS syntax" {
    $files = rg --files quote-service | Where-Object { $_ -like "*.js" }
    foreach ($file in $files) {
      node --check $file
      Assert-NativeSuccess "JS syntax check for $file"
    }
    Write-Host "checked $($files.Count) quote service js files"
  }

  Invoke-Step "Miniapp JSON syntax" {
    $files = rg --files wechat-miniapp | Where-Object { $_ -like "*.json" }
    foreach ($file in $files) {
      Get-Content $file -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
    }
    Write-Host "checked $($files.Count) json files"
  }

  Invoke-Step "WeChat DevTools CLI" {
    $cli = Find-WeChatDevToolsCli
    if ($cli) {
      Write-Host "found: $cli"
      Write-Host "project: $miniRoot"
      if ($OpenDevTools) {
        & $cli open --project $miniRoot
      }
    } else {
      Write-Host "not found"
      Write-Host "Open WeChat DevTools manually and import: $miniRoot"
      Write-Host "Before uploading an experience version, run scripts\init-miniapp-private-config.ps1 -AppId <your-appid>."
    }
  }

  Write-Host ""
  Write-Host "Preflight passed."
} finally {
  Pop-Location
}
