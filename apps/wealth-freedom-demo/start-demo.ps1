param(
  [int]$Port = 8000,
  [switch]$Stop
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Runtime = Join-Path $Root ".runtime"
$PidFile = Join-Path $Runtime "dev-static-server.pid"
$OutLog = Join-Path $Runtime "dev-static-server.out.log"
$ErrLog = Join-Path $Runtime "dev-static-server.err.log"
$HostName = "127.0.0.1"

function Test-DemoUrl {
  param([int]$CheckPort)

  $url = "http://$HostName`:$CheckPort/index.html?preview=phone"
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Get-ListenerPid {
  param([int]$CheckPort)

  $listener = Get-NetTCPConnection -LocalAddress $HostName -LocalPort $CheckPort -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($listener) {
    return [int]$listener.OwningProcess
  }
  return $null
}

function Test-DemoServerProcess {
  param([int]$ServerPid)

  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ServerPid" -ErrorAction SilentlyContinue
  return $process -and $process.CommandLine -like "*dev-static-server.py*"
}

function Stop-RecordedServer {
  if (!(Test-Path $PidFile)) {
    Write-Host "No recorded demo server pid found."
    return
  }

  $serverPid = [int](Get-Content $PidFile -Raw)
  $process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $serverPid
    Write-Host "Stopped demo server pid $serverPid."
  } else {
    Write-Host "Recorded demo server pid $serverPid is not running."
  }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
Set-Location $Root

if ($Stop) {
  Stop-RecordedServer
  exit 0
}

if (Test-Path $PidFile) {
  $recordedPid = [int](Get-Content $PidFile -Raw)
  if (Get-Process -Id $recordedPid -ErrorAction SilentlyContinue) {
    if (Test-DemoUrl -CheckPort $Port) {
      Write-Host "Demo server is already running."
      Write-Host "Demo: http://$HostName`:$Port/index.html?preview=phone"
      Write-Host "Stop: .\start-demo.ps1 -Stop"
      exit 0
    }
  }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

$selectedPort = $Port
$listenerPid = Get-ListenerPid -CheckPort $selectedPort
if ($listenerPid) {
  if (Test-DemoUrl -CheckPort $selectedPort) {
    if (Test-DemoServerProcess -ServerPid $listenerPid) {
      Set-Content -Path $PidFile -Value $listenerPid -Encoding ASCII
      Write-Host "Recorded existing demo server pid $listenerPid."
    }
    Write-Host "Port $selectedPort already serves this demo."
    Write-Host "Demo: http://$HostName`:$selectedPort/index.html?preview=phone"
    Write-Host "Stop: .\start-demo.ps1 -Stop"
    exit 0
  }

  $fallback = ($Port + 1)..($Port + 20) | Where-Object { -not (Get-ListenerPid -CheckPort $_) } | Select-Object -First 1
  if (!$fallback) {
    throw "Port $Port is occupied by pid $listenerPid and no free fallback port was found."
  }
  Write-Host "Port $Port is occupied by pid $listenerPid; using fallback port $fallback."
  $selectedPort = [int]$fallback
}

$python = (Get-Command python -ErrorAction Stop).Source
$process = Start-Process -FilePath $python `
  -ArgumentList @("dev-static-server.py", "--host", $HostName, "--port", "$selectedPort") `
  -WorkingDirectory $Root `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog `
  -WindowStyle Hidden `
  -PassThru

Set-Content -Path $PidFile -Value $process.Id -Encoding ASCII

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 250
  if (Test-DemoUrl -CheckPort $selectedPort) {
    $ready = $true
    break
  }
}

if (!$ready) {
  throw "Demo server started as pid $($process.Id), but preview validation did not return HTTP 200. Check $ErrLog"
}

Write-Host "Demo server ready."
Write-Host "Demo: http://$HostName`:$selectedPort/index.html?preview=phone"
Write-Host "Desktop shell: http://$HostName`:$selectedPort/"
Write-Host "Stop: .\start-demo.ps1 -Stop"
