# Disaster Response Platform — stop all dev services
# Kills all Python uvicorn and mqtt_kafka_bridge processes.

Write-Host ""
Write-Host "Stopping all platform processes..." -ForegroundColor Yellow

Get-Process python -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  Stopping PID $($_.Id) ($($_.ProcessName))" -ForegroundColor Red
    Stop-Process -Id $_.Id -Force
}

Write-Host "Done." -ForegroundColor Green
Write-Host ""
