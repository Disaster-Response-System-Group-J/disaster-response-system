# J1 + J2 Deployment Guide — For J4 Developers

> This document tells J4 what they need to do to get J1 and J2 running inside the shared Docker platform.
> J4 owns the infrastructure (`docker-compose.yml`, `.env`, secrets, Kong routes). J1 and J2 just need their images built and their env vars wired correctly.

---

## What J1 and J2 Need From J4

### Short answer

| Service | Already in `docker-compose.yml`? | Needs from J4 |
|---------|----------------------------------|---------------|
| `j1-bridge-api` | Yes | Just build it — all env vars already set |
| `j1-mqtt-forwarder` | Yes | Add MQTT credentials to root `.env` |
| `j2-data-intelligence` | Yes | Add `DATABASE_URL` and `GEMINI_API_KEY` to root `.env` |

---

## Step 1 — Root `.env` File

J4 manages the root `.env`. Add these entries if not already present:

```env
# ── J1 MQTT Forwarder ──────────────────────────────────────────
MQTT_BROKER=8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=j1_gateway
MQTT_PASSWORD=8797Sudil

# ── J2 Data Intelligence ───────────────────────────────────────
# IMPORTANT: Use the Supabase connection string, not postgres:5432
# postgres:5432 is the Docker-internal hostname — J2 must use Supabase
DATABASE_URL=postgresql://postgres:DisasterMangementSystem%40j2@db.qfhmczryyyddgitnlndy.supabase.co:5432/postgres
GEMINI_API_KEY=<get from J2 team>
```

> **Why Supabase and not the local `postgres` container?**  
> J2's database is Supabase-hosted (owned by J2 team). The local `disaster-postgres` container is used by J3 and J4, not J2. Using `postgres:5432` for J2 will cause DB connection failures.

---

## Step 2 — One-Time Supabase DB Setup

Run this **once** in the Supabase SQL editor (ask J2 team for access, or they run it themselves):

```sql
-- Required for J2's SOS consumer to be idempotent
ALTER TABLE public."IncomingReport"
  ADD CONSTRAINT incoming_report_sos_id_unique UNIQUE ("sosId");
```

This constraint prevents duplicate SOS reports if Kafka redelivers a message. Without it, the `ON CONFLICT` in J2's INSERT does nothing and duplicates silently pile up.

---

## Step 3 — Build and Start

J1 and J2 images are built from local Dockerfiles. Run from the repo root:

```bash
# Build just J1 and J2:
docker compose build j1-bridge-api j1-mqtt-forwarder j2-data-intelligence

# Or build + start everything:
docker compose up -d --build
```

Verify:

```bash
curl http://localhost:8081/health
# → {"status":"ok","service":"j1-bridge-api","idempotency_keys":0}

curl http://localhost:8082/api/v1/health
# → {"status":"healthy"}
```

---

## Step 4 — Verify Kafka Wiring

J1 publishes to Kafka, J2 consumes from it. The shared `disaster-kafka` container handles this. Verify topics are being used:

```bash
docker exec disaster-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --list
```

Expected topics (auto-created on first publish):
- `j1.sos.raw-reports`
- `j1.sensor.telemetry`
- `j2.engine.risk-alerts`

Check J2 consumer groups are active:

```bash
docker exec disaster-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 --list
```

Should show: `j2-sensor-consumer` and `j2-report-consumer`.

---

## Step 5 — Kong API Gateway Routes (optional but recommended)

J4 owns Kong. Register J1 and J2 behind Kong so all traffic goes through `:8000`:

### J1 Bridge API

```bash
# Create service
curl -X POST http://localhost:8001/services \
  -d name=j1-bridge-api \
  -d url=http://j1-bridge-api:8081

# Create route
curl -X POST http://localhost:8001/services/j1-bridge-api/routes \
  -d "paths[]=/api/v1/devices" \
  -d "strip_path=false"
```

Mobile app then sends to `http://<server-ip>:8000/api/v1/ingest/report`.

### J2 Data Intelligence

```bash
curl -X POST http://localhost:8001/services \
  -d name=j2-intelligence \
  -d url=http://j2-data-intelligence:8082

curl -X POST http://localhost:8001/services/j2-intelligence/routes \
  -d "paths[]=/api/v1/intelligence" \
  -d "strip_path=false"
```

---

## What J4 Does NOT Need To Touch

| Thing | Why |
|-------|-----|
| `j2-data-intelligence/docker-compose.yml` | **Do not run this.** It starts a conflicting Kafka on port 9092. It was used by J2 for isolated local dev before integration. In the shared platform, ignore it entirely. |
| `j2-data-intelligence/.env` | This is only for local dev (running J2 outside Docker). In Docker, all env vars come from the root `.env` via `docker-compose.yml`. |
| J2's ML model `.pkl` files | Bundled inside the Docker image at build time — no action needed. |
| J2's APScheduler jobs | Start automatically when J2 starts — no action needed. |
| J1's idempotency store | In-memory, resets on restart — by design, no persistence needed. |

---

## Troubleshooting

### J2 starts but `IncomingReport` inserts fail silently

**Symptom:** Kafka consumer group `j2-report-consumer` shows LAG=0 but no rows in Supabase.

**Cause 1 — Wrong DATABASE_URL:** J2 is connecting to `postgres:5432` (Docker-internal) instead of Supabase.  
**Fix:** Set `DATABASE_URL` in root `.env` to the Supabase URL (see Step 1).

**Cause 2 — Missing UNIQUE constraint on sosId:** `ON CONFLICT ("sosId") DO NOTHING` silently fails.  
**Fix:** Run the `ALTER TABLE` from Step 2.

---

### J2 consumer group is stuck / not reading new messages

```bash
# Check group state
docker exec disaster-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group j2-report-consumer --describe

# If it shows members but LAG keeps growing, restart J2:
docker compose restart j2-data-intelligence

# If group won't go inactive (members stuck), reset offset:
docker compose stop j2-data-intelligence

docker exec disaster-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group j2-report-consumer \
  --topic j1.sos.raw-reports \
  --reset-offsets --to-earliest --execute

docker compose start j2-data-intelligence
```

---

### J1 returning 503 to mobile app

**Cause:** J1 can't reach Kafka (e.g. Kafka not healthy yet at startup).

```bash
# Check J1 logs
docker logs j1-bridge-api --tail 50

# Check Kafka health
docker inspect disaster-kafka | grep -A5 '"Health"'

# Restart J1 after Kafka is healthy
docker compose restart j1-bridge-api
```

---

### MQTT Forwarder not connecting to HiveMQ

```bash
docker logs j1-mqtt-forwarder --tail 50
```

Common causes:
- `MQTT_TLS=true` not set → HiveMQ Cloud requires TLS on port 8883
- Wrong credentials → check `MQTT_USERNAME` and `MQTT_PASSWORD` in `.env`
- DNS resolution failure → the `docker-compose.yml` entry for `j1-mqtt-forwarder` already has `dns: [1.1.1.1, 8.8.8.8]` to fix this

---

## End-to-End Verification

After deploying, run this from the server to confirm the full pipeline works:

```bash
curl -X POST http://localhost:8081/api/v1/ingest/report \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: j4-deploy-test-001" \
  -d '{
    "eventId":     "j4-deploy-test-001",
    "deviceId":    "test-device",
    "timestamp":   "2026-05-16T12:00:00Z",
    "disasterType":"FLOOD",
    "district":    "Colombo",
    "latitude":    6.9271,
    "longitude":   79.8612,
    "description": "J4 deployment verification test"
  }'
```

Expected result within 5 seconds:
1. `201` response from J1
2. Message visible in Kafka UI → topic `j1.sos.raw-reports`
3. New row in Supabase `public."IncomingReport"` with `district = Colombo`

If all three pass, J1 + J2 are correctly deployed.
