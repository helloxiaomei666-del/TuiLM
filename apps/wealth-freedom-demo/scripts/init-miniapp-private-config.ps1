param(
  [Parameter(Mandatory = $true)]
  [string]$AppId
)

$ErrorActionPreference = "Stop"

if ($AppId -notmatch "^wx[a-zA-Z0-9]{8,}$") {
  throw "AppId should look like wx followed by your mini program id."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$privateConfig = Join-Path $repoRoot "wechat-miniapp\project.private.config.json"

$config = [ordered]@{
  appid = $AppId
  projectname = "wealth-freedom-demo"
}

$json = $config | ConvertTo-Json -Depth 5
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($privateConfig, $json, $utf8NoBom)

Write-Host "Wrote local miniapp private config:"
Write-Host $privateConfig
Write-Host "This file is ignored by git. Run scripts\wechat-miniapp-preflight.ps1 before importing or uploading."
