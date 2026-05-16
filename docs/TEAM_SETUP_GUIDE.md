# Disaster Response Platform — Team Setup Guide

> For J1 / J2 / J3 / J4 developers cloning this branch and running the full stack locally.

---

## Architecture at a Glance

```
Flutter App (J1) → J1 Bridge API :8081 → Kafka → J2 :8082 → Supabase DB
                                                ↓
                                          J3 Dashboard :3000
IoT Sensors → J1 MQTT Forwarder ──────────────↑
```

**One shared Kafka** runs in Docker (`disaster-kafka` on `localhost:9092`). Every subgroup connects to it.  
**Do not** run `j2-data-intelligence/docker-compose.yml` — it spins up a conflicting Kafka on the same port.

---

## Step 0 — Clone & Prerequisites

```bash
git clone <repo-url>
cd disaster-response-system
git checkout main_copy
```

Required tools:
- Docker Desktop (running)
- Python 3.11+
- Node.js 20+ (J3)
- Flutter SDK (J1 mobile)

---

## Step 1 — Start Shared Infrastructure (everyone does this first)

From the repo root:

```bash
docker compose up -d
```

Wait ~60 seconds, then verify:

| Service | URL | Status check |
|---|---|---|
| Kafka | `localhost:9092` | See Kafka UI below |
| Kafka UI | http://localhost:18085 | Should load |
| Postgres | `localhost:5432` | `disaster` / `disaster123` |
| Kong | http://localhost:8000 | — |
| Keycloak | http://localhost:8180 | admin / admin123 |
| Grafana | http://localhost:3030 | admin / admin123 |
| Prometheus | http://localhost:9090 | — |

---

## J1 Developers — Bridge API + Mobile App

### J1 Bridge API

```bash
cd j1-device-edge/backend
pip install -r requirements.txt
```

Set env vars and run:

```powershell
# PowerShell
$env:KAFKA_BOOTSTRAP_SERVERS      = "localhost:9092"
$env:KAFKA_TOPIC_SOS_REPORTS      = "j1.sos.raw-reports"
$env:KAFKA_TOPIC_SENSOR_TELEMETRY = "j1.sensor.telemetry"
$env:API_HOST = "0.0.0.0"
$env:API_PORT = "8081"
$env:CORS_ORIGINS = "*"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8081 --reload
```

Health check: `GET http://localhost:8081/health` → `{"status":"ok"}`

### J1 MQTT Forwarder (IoT sensors → Kafka)

In a second terminal:

```powershell
cd j1-device-edge/backend
$env:KAFKA_BOOTSTRAP_SERVERS       = "localhost:9092"
$env:KAFKA_TOPIC_SENSOR_TELEMETRY  = "j1.sensor.telemetry"
$env:MQTT_BROKER   = "8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud"
$env:MQTT_PORT     = "8883"
$env:MQTT_USERNAME = "j1_gateway"
$env:MQTT_PASSWORD = "8797Sudil"
$env:MQTT_TLS      = "true"
python -m app.mqtt_http_forwarder
```

### Convenience Script (starts all 3 J1+J2 services at once)

From the repo root:

```powershell
.\start_platform.ps1
```

To stop all:

```powershell
.\stop_platform.ps1
```

### Mobile App

Requirements: Flutter SDK, Android device or emulator with USB debugging enabled.

```bash
cd j1-device-edge/mobile_app
flutter pub get
flutter devices          # find your device ID
flutter run --device-id <id>
```

Build APK:

```bash
flutter build apk --debug
# Output: build/app/outputs/flutter-apk/app-debug.apk
flutter install --debug  # installs to connected phone
```

**Important — API base URL:** The phone cannot reach `localhost`. In the app settings, set the API base URL to your machine's local network IP:

```
http://192.168.x.x:8081
```

Find your IP: `ipconfig` → WiFi adapter → IPv4 address. Phone and PC must be on the same WiFi.

---

## J2 Developers — Data Intelligence Service

### Critical: do NOT use J2's own docker-compose

`j2-data-intelligence/docker-compose.yml` starts its own Kafka on port `9092` — this **conflicts** with the shared `disaster-kafka`. Always use the shared infrastructure from Step 1 and run J2 locally.

### Setup

```bash
cd j2-data-intelligence
pip install -r requirements.txt
```

Create your `.env` — **never commit this file**:

```bash
cp .env.example .env
```

Edit `.env` with these values:

```env
# Use the Supabase URL — NOT postgres:5432 (that's the Docker-internal hostname)
DATABASE_URL=postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres

KAFKA_BROKER=localhost:9092
KAFKA_TOPIC_SENSOR=j1.sensor.telemetry
KAFKA_TOPIC_SOS_REPORTS=j1.sos.raw-reports
KAFKA_CONSUMER_GROUP=j2-sensor-consumer
KAFKA_TOPIC_RISK_ALERTS=j2.engine.risk-alerts

GEMINI_API_KEY=<your-key>

APP_HOST=0.0.0.0
APP_PORT=8082
LOG_LEVEL=INFO
```

### One-time DB setup (run once against Supabase)

The `IncomingReport` table needs a unique constraint on `sosId` for idempotent inserts to work:

```sql
ALTER TABLE public."IncomingReport"
  ADD CONSTRAINT incoming_report_sos_id_unique UNIQUE ("sosId");
```

Run this in the Supabase SQL editor. If it already exists, it will error harmlessly — ignore it.

### Start J2

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8082 --reload
```

Health check: `GET http://localhost:8082/api/v1/health` → `{"status":"healthy"}`

### Verify Kafka consumers are running

Open Kafka UI at http://localhost:18085 → **Consumer Groups**:

- `j2-sensor-consumer` active on `j1.sensor.telemetry`
- `j2-report-consumer` active on `j1.sos.raw-reports`

Both should show **LAG = 0** once caught up.

### If consumer offsets are stale (stuck, not reading new messages)

This happens if J2 crashed while a consumer group was active. Fix:

```powershell
# 1. Stop J2 completely
# 2. Kill any leftover Python processes connected to Kafka:
netstat -ano | Select-String ":9092.*ESTABLISHED"
# Kill the PIDs shown (that are python3.11)
Stop-Process -Id <pid> -Force

# 3. Wait ~20 seconds, then reset the offset:
$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
& $docker exec disaster-kafka /opt/kafka/bin/kafka-consumer-groups.sh `
  --bootstrap-server localhost:9092 `
  --group j2-report-consumer `
  --topic j1.sos.raw-reports `
  --reset-offsets --to-earliest --execute

# 4. Restart J2
```

---

## J3 Developers — Dashboard Frontend

J3 reads from Supabase (IncomingReport, ConfirmedIncident etc.) and receives live events via Socket.IO from `event-bridge.js` which consumes `j2.engine.risk-alerts` from Kafka.

J1 and J2 must be running to produce data.

```bash
cd j3-system-interaction
docker compose up --build
# Starts Kafka event bridge + Next.js dashboard together
```

Or for local dev:

```bash
cd j3-system-interaction/dms
npm install
npm run dev          # dashboard on :3000 (terminal 1)
node event-bridge.js # Kafka → Socket.IO bridge (terminal 2)
```

To inject synthetic Kafka events for testing without real IoT sensors:

```bash
node mock-producer.js
```

---

## J4 Developers — Platform Security

Everything J4 runs inside Docker via the shared `docker compose up -d` from Step 1.

Kong, Keycloak, Vault, Prometheus, Grafana, ELK, and the blockchain audit service all start automatically.

```bash
# Restart just J4 services if needed:
docker compose restart kong keycloak vault prometheus grafana
```

---

## End-to-End Smoke Test (quick sanity check for everyone)

With J1 and J2 running, send a test SOS report directly without needing the phone:

```bash
curl -X POST http://localhost:8081/api/v1/ingest/report \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: smoke-test-001" \
  -d '{
    "eventId":     "smoke-test-001",
    "deviceId":    "test-device",
    "timestamp":   "2026-05-16T12:00:00Z",
    "disasterType":"FLOOD",
    "district":    "Colombo",
    "latitude":    6.9271,
    "longitude":   79.8612,
    "description": "Smoke test report from curl"
  }'
```

Expected chain:
1. J1 responds `201` → message published to `j1.sos.raw-reports`
2. Kafka UI shows new message at http://localhost:18085
3. J2 consumer picks it up within 2 seconds
4. New row appears in Supabase `public."IncomingReport"` with `district = Colombo`

---

## What NOT to do

| Don't | Why |
|---|---|
| Run `j2-data-intelligence/docker-compose.yml` | Starts a second Kafka on port 9092, conflicts with shared infra |
| Set `DATABASE_URL=postgresql://postgres:5432/...` | `postgres` is a Docker hostname — only works inside containers, not from local Python |
| Use `localhost` as the API URL in the mobile app | Phone can't reach your PC's localhost — use the WiFi IP |
| Commit `.env` files | Contains DB passwords and API keys |
