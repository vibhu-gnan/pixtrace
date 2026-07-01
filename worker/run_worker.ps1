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

while ($true) {
    # Roll the log if it grows past ~10 MB
    if ((Test-Path $logFile) -and ((Get-Item $logFile).Length -gt 10MB)) {
        Move-Item $logFile "$logFile.1" -Force -ErrorAction SilentlyContinue
    }

    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content $logFile "[$stamp] === launching face_worker.py ===" -Encoding UTF8

    # Run the worker; merge stdout+stderr and append as UTF-8 (line-buffered).
    & $python $script 2>&1 | ForEach-Object { $_ | Out-File -FilePath $logFile -Append -Encoding UTF8 }

    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content $logFile "[$stamp] === worker exited; restarting in 5s ===" -Encoding UTF8
    Start-Sleep -Seconds 5
}
