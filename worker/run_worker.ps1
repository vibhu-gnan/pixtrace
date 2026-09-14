# PIXTRACE face worker launcher (self-restarting).
# Runs the worker in a loop so it comes back if the process ever exits.
# Started at logon by the "PixtraceFaceWorker" scheduled task (see install-service.ps1),
# or run manually:  powershell -ExecutionPolicy Bypass -File run_worker.ps1
#
# Logs everything to worker.log (rolled at ~10 MB). Tail it with:
#   Get-Content C:\PIXTRACE\worker\worker.log -Wait -Tail 20

$ErrorActionPreference = 'Continue'
$workerDir = 'C:\PIXTRACE\worker'
$python    = Join-Path $workerDir '.venv\Scripts\python.exe'
$script    = Join-Path $workerDir 'face_worker.py'
$logFile   = Join-Path $workerDir 'worker.log'

Set-Location $workerDir

$fastExits = 0

while ($true) {
    # Roll the log if it grows past ~10 MB
    if ((Test-Path $logFile) -and ((Get-Item $logFile).Length -gt 10MB)) {
        Move-Item $logFile "$logFile.1" -Force -ErrorAction SilentlyContinue
    }

    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    if (-not (Test-Path $python)) {
        Add-Content $logFile "[$stamp] !!! venv python missing at $python - rebuild it with: python -m venv .venv; .\.venv\Scripts\python.exe -m pip install -r requirements.txt" -Encoding UTF8
        Start-Sleep -Seconds 60
        continue
    }

    Add-Content $logFile "[$stamp] === launching face_worker.py ===" -Encoding UTF8

    # Run the worker; merge stdout+stderr and append as UTF-8 (line-buffered).
    $startedAt = Get-Date
    & $python $script 2>&1 | ForEach-Object { $_ | Out-File -FilePath $logFile -Append -Encoding UTF8 }
    $ranSeconds = [int]((Get-Date) - $startedAt).TotalSeconds

    # A worker dying on startup used to relaunch every 5s forever, burying the
    # real error under thousands of restart lines. Back off instead, and say so.
    if ($ranSeconds -lt 15) {
        $fastExits++
        $delay = [int][Math]::Min(5 * [Math]::Pow(2, $fastExits - 1), 300)
    } else {
        $fastExits = 0
        $delay = 5
    }

    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    if ($fastExits -ge 3) {
        Add-Content $logFile "[$stamp] !!! startup is failing - exited after ${ranSeconds}s, $fastExits times in a row. The real error is above this line." -Encoding UTF8
    }
    Add-Content $logFile "[$stamp] === worker exited after ${ranSeconds}s; restarting in ${delay}s ===" -Encoding UTF8
    Start-Sleep -Seconds $delay
}
