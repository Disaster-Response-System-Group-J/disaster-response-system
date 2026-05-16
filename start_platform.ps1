# Disaster Response Platform — local dev startup
# Starts J1 Bridge API, J1 MQTT Forwarder, and J2 Data Intelligence
# in separate windows automatically.
#
# Usage: right-click -> "Run with PowerShell"
#        OR from any PowerShell terminal: .\start_platform.ps1

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Definition
$J1   = Join-Path $ROOT "j1-device-edge\backend"
$J2   = Join-Path $ROOT "j2-data-intelligence"

# ── Shared Kafka env (used by J1 and MQTT forwarder) ──────────────────────────
$KAFKA_BROKER              = "localhost:9092"
$KAFKA_TOPIC_SOS           = "j1.sos.raw-reports"
$KAFKA_TOPIC_SENSOR        = "j1.sensor.telemetry"

# ── HiveMQ credentials ────────────────────────────────────────────────────────
$MQTT_BROKER   = "8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud"
$MQTT_PORT     = "8883"
$MQTT_USERNAME = "j1_gateway"
$MQTT_PASSWORD = "8797Sudil"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Disaster Response Platform — Dev Startup  " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting 3 services in separate windows..." -ForegroundColor Yellow
Write-Host ""

# ── Window 1: J1 Bridge API ───────────────────────────────────────────────────
Write-Host "[1/3] J1 Bridge API  ->  http://localhost:8081" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  `$host.UI.RawUI.WindowTitle = 'J1 Bridge API :8081'
  cd '$J1'
  `$env:KAFKA_BOOTSTRAP_SERVERS    = '$KAFKA_BROKER'
  `$env:KAFKA_TOPIC_SOS_REPORTS    = '$KAFKA_TOPIC_SOS'
  `$env:KAFKA_TOPIC_SENSOR_TELEMETRY = '$KAFKA_TOPIC_SENSOR'
  `$env:API_HOST = '0.0.0.0'
  `$env:API_PORT = '8081'
  `$env:CORS_ORIGINS = '*'
  `$env:IDEMPOTENCY_MAX_KEYS = '50000'
  Write-Host 'J1 Bridge API starting...' -ForegroundColor Green
  python -m uvicorn app.main:app --host 0.0.0.0 --port 8081 --reload
"@

Start-Sleep -Seconds 2

# ── Window 2: J1 MQTT Forwarder ───────────────────────────────────────────────
Write-Host "[2/3] J1 MQTT Forwarder  ->  HiveMQ Cloud" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  `$host.UI.RawUI.WindowTitle = 'J1 MQTT Forwarder'
  cd '$J1'
  `$env:KAFKA_BOOTSTRAP_SERVERS      = '$KAFKA_BROKER'
  `$env:KAFKA_TOPIC_SENSOR_TELEMETRY = '$KAFKA_TOPIC_SENSOR'
  `$env:MQTT_BROKER   = '$MQTT_BROKER'
  `$env:MQTT_PORT     = '$MQTT_PORT'
  `$env:MQTT_USERNAME = '$MQTT_USERNAME'
  `$env:MQTT_PASSWORD = '$MQTT_PASSWORD'
  `$env:MQTT_TLS      = 'true'
  Write-Host 'J1 MQTT Forwarder starting...' -ForegroundColor Green
  python -m app.mqtt_http_forwarder
"@

Start-Sleep -Seconds 2

# ── Window 3: J2 Data Intelligence ────────────────────────────────────────────
Write-Host "[3/3] J2 Data Intelligence  ->  http://localhost:8082" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  `$host.UI.RawUI.WindowTitle = 'J2 Data Intelligence :8082'
  cd '$J2'
  Write-Host 'J2 Data Intelligence starting...' -ForegroundColor Green
  python -m uvicorn app.main:app --host 0.0.0.0 --port 8082 --reload
"@

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  All 3 services launched." -ForegroundColor Cyan
Write-Host ""
Write-Host "  J1 Bridge API    ->  http://localhost:8081/health" -ForegroundColor White
Write-Host "  J2 Intelligence  ->  http://localhost:8082/api/v1/health" -ForegroundColor White
Write-Host "  Kafka UI         ->  http://localhost:18085" -ForegroundColor White
Write-Host ""
Write-Host "  Wait ~10 seconds for all services to fully start." -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
