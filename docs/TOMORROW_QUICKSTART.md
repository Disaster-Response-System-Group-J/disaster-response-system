# Tomorrow's Quickstart — Resume Dev Session

Everything is already set up. This is the exact sequence to get back to a working state.

---

## 1. Start Docker infrastructure

```bash
# From repo root
docker compose up -d
```

Wait ~30 seconds. Verify Kafka is healthy:

```
http://localhost:18085   ← Kafka UI should load
```

---

## 2. Start all services (one command)

```powershell
# From repo root
.\start_platform.ps1
```

This opens 3 PowerShell windows:
- **J1 Bridge API** → http://localhost:8081
- **J1 MQTT Forwarder** → connects to HiveMQ Cloud
- **J2 Data Intelligence** → http://localhost:8082

Wait ~10 seconds, then verify both are healthy:

```powershell
Invoke-RestMethod http://localhost:8081/health
# → {"status":"ok","service":"j1-bridge-api",...}

Invoke-RestMethod http://localhost:8082/api/v1/health
# → {"status":"healthy"}
```

---

## 3. Check Kafka consumers are running

Open http://localhost:18085 → Consumer Groups. You should see:

| Group | Topic | LAG |
|---|---|---|
| `j2-sensor-consumer` | `j1.sensor.telemetry` | 0 |
| `j2-report-consumer` | `j1.sos.raw-reports` | 0 |

---

## 4. Install app to phone (if needed)

Connect phone via USB with USB Debugging on.

```powershell
cd j1-device-edge/mobile_app
flutter devices         # confirm phone is listed
flutter install --debug # installs the already-built APK
```

If you changed Flutter code, rebuild first:

```powershell
flutter build apk --debug
flutter install --debug
```

---

## 5. Confirm the full pipeline works

Send a test SOS from PowerShell:

```powershell
Invoke-RestMethod -Uri "http://localhost:8081/api/v1/ingest/report" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json"; "Idempotency-Key" = "resume-test-001" } `
  -Body '{"eventId":"resume-test-001","deviceId":"test","timestamp":"2026-05-17T08:00:00Z","disasterType":"FLOOD","district":"Colombo","latitude":6.9271,"longitude":79.8612,"description":"Resume session smoke test"}'
```

Then check Supabase — a new row should appear in `public."IncomingReport"` within ~2 seconds.

---

## If something is broken

### J1 not responding on :8081

```powershell
# Check what's on the port
netstat -ano | Select-String ":8081.*LISTEN"

# Kill stuck processes and restart
$pids = netstat -ano | Select-String ":8081.*LISTEN" | ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique
foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }

# Then re-run start_platform.ps1 or restart just J1 manually
```

### J2 consuming from Kafka but nothing writing to DB

This was the bug we fixed (`mediaUrls` array type). If it regresses, check J2 terminal window for errors like `malformed array literal`. The fix is already committed — make sure you have the latest code.

### Consumer group stuck / LAG never goes to 0

```powershell
# Stop J2 first, then kill any lingering Python Kafka connections
netstat -ano | Select-String ":9092.*ESTABLISHED"
# Kill the python3.11 PIDs shown

# Wait 20 seconds, then reset offset
$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
& $docker exec disaster-kafka /opt/kafka/bin/kafka-consumer-groups.sh `
  --bootstrap-server localhost:9092 --group j2-report-consumer `
  --topic j1.sos.raw-reports --reset-offsets --to-earliest --execute

# Restart J2
```

### App shows "Queued" and never syncs

- Check phone and PC are on the same WiFi
- Verify API URL in app settings is `http://192.168.x.x:8081` (your PC's WiFi IP, not `localhost`)
- Check J1 is healthy: `Invoke-RestMethod http://localhost:8081/health`
- The app retries every 30 seconds automatically — once J1 is back up it will sync on its own

---

## What's next to build

- [ ] Connect J3 event bridge to consume `j2.engine.risk-alerts` so live ML alerts appear on the dashboard
- [ ] Flutter app: district field currently defaults to Colombo on form reset — consider remembering the last-used district
