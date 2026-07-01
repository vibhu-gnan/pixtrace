# Registers the PIXTRACE face worker to auto-start at logon and restart on crash.
# No admin required — runs as a per-user Scheduled Task in your logged-in session.
# Re-run any time to update it. To remove: Unregister-ScheduledTask -TaskName PixtraceFaceWorker -Confirm:$false
#
#   powershell -ExecutionPolicy Bypass -File install-service.ps1

$taskName = 'PixtraceFaceWorker'
$launcher = 'C:\PIXTRACE\worker\run_worker.ps1'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -NonInteractive -File `"$launcher`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Laptop-friendly: keep running on battery, restart if it ever fails, no time limit.
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Force | Out-Null

Write-Output "Registered scheduled task '$taskName' (runs at logon, restarts on crash)."
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State | Format-Table -AutoSize
