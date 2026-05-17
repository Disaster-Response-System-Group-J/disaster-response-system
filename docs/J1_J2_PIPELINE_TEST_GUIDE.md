# J1 → J2 Pipeline Test Guide

End-to-end verification of the sensor and SOS data flows:
HiveMQ → Kafka → J2 consumers → Supabase.

---

## Architecture

```
PATH A — Sensor (IoT hardware)
  HiveMQ Cloud (TLS :8883)
    topic: j1/disaster/flood
    topic: j1/disaster/landslide
        ↓  paho-mqtt subscriber (j1-mqtt-forwarder)
  Kafka topic: j1.sensor.telemetry
        ↓  confluent-kafka consumer (j2, group=j2-sensor-consumer)
  Supabase: iot_flood  |  iot_landslide
        ↓  APScheduler every 30 s
  Supabase: iot_predictions  (horizons 0 / 1 / 2 / 3)

PATH B — SOS (mobile app)
  POST /api/v1/ingest/report  →  j1-bridge-api :8081
        ↓  confluent-kafka producer
  Kafka topic: j1.sos.raw-reports
        ↓  confluent-kafka consumer (j2, group=j2-report-consumer)
  Supabase: public."IncomingReport"
```

---

## Prerequisites

| Requirement | Version |
|---|---|
| Docker Desktop (WSL2 backend, Windows) | ≥ 4.30 |
| RAM allocated to Docker | ≥ 8 GB |
| Python on host (for smoke scripts) | 3.11+ |

Install host-side Python deps once:

```bash
pip install paho-mqtt requests psycopg2-binary python-dotenv
```

---

## One-Time Setup

### 1. Clone and checkout

```bash
git clone https://github.com/Disaster-Response-System-Group-J/disaster-response-system.git
cd disaster-response-system
git checkout main_copy
```

### 2. Place `.env` at repo root

`.env` is gitignored — obtain it from the team out-of-band. Minimum required vars for the J1↔J2 path:

```env
# Supabase — IPv4 session pooler (only reachable path from Docker)
DATABASE_URL=postgresql+psycopg2://postgres.qfhmczryyyddgitnlndy:DisasterMangementSystem%40j2@aws-1-ap-south-1.pooler.supabase.com:6543/postgres

# Kafka (internal docker network address — do not change)
KAFKA_BOOTSTRAP_SERVERS=kafka:29092
KAFKA_BROKERS=kafka:29092

# HiveMQ Cloud broker
MQTT_BROKER=8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=j1_gateway
MQTT_PASSWORD=8797Sudil

# J1 internal auth token
INTERNAL_SERVICE_TOKEN=dev-secret-token

# J2 ML agent (optional for J1↔J2 path; required for /allocate endpoint)
GEMINI_API_KEY=<your key>

# Required by root compose for postgres/keycloak/kong containers
# (not used by J1/J2 but docker compose will fail without them)
POSTGRES_USER=disaster
POSTGRES_PASSWORD=DisasterMangementSystem@j2
POSTGRES_DB=disasterdb
J3_DB_USER=j3user
J3_DB_PASSWORD=j3_password_dev
J3_DB_NAME=j3db
KONG_DB_USER=kong
KONG_DB_PASSWORD=kong_password_dev
KONG_DB_NAME=kong
KC_DB_USERNAME=keycloak
KC_DB_PASSWORD=keycloak_password_dev
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin123
KC_ISSUER=http://localhost:8180/realms/disaster-response
VAULT_DEV_ROOT_TOKEN_ID=dev-root-token
AUDIT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
GF_SECURITY_ADMIN_PASSWORD=admin123
ALERTMANAGER_EMAIL_PASSWORD=
ELK_LOG_RETENTION_DAYS=14
SERVER_IP=localhost
```

> **Supabase note:** The direct host (`db.*.supabase.co`) is IPv6-only on the free tier.
> Docker containers cannot reach IPv6. Always use the `aws-1-ap-south-1.pooler.supabase.com:6543`
> session-pooler URL above — that is the only IPv4-reachable path.

---

## Start Services

Bring up only the J1↔J2 path (skip Kong, Keycloak, Grafana, etc.):

```bash
docker compose up -d kafka j1-bridge-api j1-mqtt-forwarder j2-data-intelligence
docker compose ps
```

Expected output:

```
NAME                    STATUS
disaster-kafka          Up (healthy)
j1-bridge-api           Up (healthy)
j1-mqtt-forwarder       Up
j2-data-intelligence    Up
```

### Optional: Kafka UI (visual message inspection)

```bash
docker compose -f j1-device-edge/docker-compose.yml up -d kafka-ui
```

Open http://localhost:18085 → cluster `j1-local` → topics `j1.sensor.telemetry` and `j1.sos.raw-reports`.

### Health check

```bash
curl http://localhost:8081/health          # J1 → {"status":"ok"}
curl http://localhost:8082/api/v1/health   # J2 → {"status":"healthy"}
```

---

## Smoke Test Scripts

Create the four scripts below under `scripts/smoke/` and run them in order.

### `scripts/smoke/pub_flood.py` — publish a flood sensor reading via HiveMQ

```python
"""Publish a test flood payload to HiveMQ → j1/disaster/flood.
Verifies: HiveMQ Cloud TLS → j1-mqtt-forwarder → Kafka j1.sensor.telemetry → iot_flood row.
"""
import json, ssl, time, uuid
import paho.mqtt.client as mqtt

DEVICE = f"test-flood-{uuid.uuid4().hex[:6]}"
PAYLOAD = {
    "id": DEVICE,
    "type": "FLOOD",
    "temp": 31.2,
    "hum": 88,
    "depth": 55.0,
    "latitude": 6.9271,
    "longitude": 79.8612,
}

connected = []

def on_connect(client, userdata, flags, rc, props=None):
    connected.append(rc)
    print(f"HiveMQ connect rc={rc}")

client = mqtt.Client(
    callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    client_id=f"smoke-{uuid.uuid4().hex[:6]}",
    protocol=mqtt.MQTTv5,
)
client.username_pw_set("j1_gateway", "8797Sudil")
client.tls_set(tls_version=ssl.PROTOCOL_TLS_CLIENT)
client.tls_insecure_set(False)
client.on_connect = on_connect

client.connect("8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud", 8883, keepalive=30)
client.loop_start()

for _ in range(30):
    if connected:
        break
    time.sleep(0.2)

result = client.publish("j1/disaster/flood", json.dumps(PAYLOAD), qos=1)
result.wait_for_publish(timeout=10)
print(f"Published — device={DEVICE}  rc={result.rc}")
print(f"  Expected in logs: iot_flood inserted: device={DEVICE}")
client.loop_stop()
client.disconnect()
```

### `scripts/smoke/pub_landslide.py` — publish a landslide sensor reading via HiveMQ

```python
"""Publish a test landslide payload to HiveMQ → j1/disaster/landslide.
Verifies: HiveMQ Cloud TLS → j1-mqtt-forwarder → Kafka j1.sensor.telemetry → iot_landslide row.
"""
import json, ssl, time, uuid
import paho.mqtt.client as mqtt

DEVICE = f"test-slide-{uuid.uuid4().hex[:6]}"
PAYLOAD = {
    "id": DEVICE,
    "type": "LANDSLIDE",
    "temp": 24.5,
    "hum": 92,
    "moist": 2800,
    "ax": 0.12, "ay": -0.08, "az": 9.81,
    "gx": 0.02, "gy": 0.01, "gz": -0.03,
    "latitude": 6.8740,
    "longitude": 80.7100,
}

connected = []

def on_connect(client, userdata, flags, rc, props=None):
    connected.append(rc)
    print(f"HiveMQ connect rc={rc}")

client = mqtt.Client(
    callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    client_id=f"smoke-{uuid.uuid4().hex[:6]}",
    protocol=mqtt.MQTTv5,
)
client.username_pw_set("j1_gateway", "8797Sudil")
client.tls_set(tls_version=ssl.PROTOCOL_TLS_CLIENT)
client.tls_insecure_set(False)
client.on_connect = on_connect

client.connect("8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud", 8883, keepalive=30)
client.loop_start()

for _ in range(30):
    if connected:
        break
    time.sleep(0.2)

result = client.publish("j1/disaster/landslide", json.dumps(PAYLOAD), qos=1)
result.wait_for_publish(timeout=10)
print(f"Published — device={DEVICE}  rc={result.rc}")
print(f"  Expected in logs: iot_landslide inserted: device={DEVICE}")
client.loop_stop()
client.disconnect()
```

### `scripts/smoke/post_sos.py` — POST SOS report through J1 bridge API

```python
"""POST a test SOS report to j1-bridge-api.
Verifies: mobile app path → Kafka j1.sos.raw-reports → IncomingReport row.
"""
import uuid, requests

EVENT_ID = str(uuid.uuid4())
BODY = {
    "eventId":     EVENT_ID,
    "deviceId":    "smoke-phone-01",
    "disasterType": "FLOOD",
    "district":    "Colombo",
    "latitude":    6.9271,
    "longitude":   79.8612,
    "description": "Smoke test SOS — flood on Galle Road near Mount Lavinia",
    "contact":     "+94771234567",
    "mediaUrls":   [],
    "timestamp":   "2026-05-17T10:00:00Z",
}

r = requests.post(
    "http://localhost:8081/api/v1/ingest/report",
    json=BODY,
    headers={"Idempotency-Key": EVENT_ID},
    timeout=10,
)
print(f"HTTP {r.status_code}  {r.text}")
print(f"eventId = {EVENT_ID}")
print(f"  Expected in logs: IncomingReport inserted: sosId={EVENT_ID}")

# Idempotency check — second call with same ID must return 409
r2 = requests.post(
    "http://localhost:8081/api/v1/ingest/report",
    json=BODY,
    headers={"Idempotency-Key": EVENT_ID},
    timeout=10,
)
print(f"\nIdempotency re-send: HTTP {r2.status_code} (expected 409)")
```

### `scripts/smoke/verify_db.py` — confirm rows landed in Supabase

```python
"""Query Supabase and print the latest rows from all four J1→J2 tables.
Run after pub_flood.py, pub_landslide.py, post_sos.py (wait ~35 s for ML cycle).
"""
import os, psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

URL = os.environ["DATABASE_URL"].replace("postgresql+psycopg2://", "postgresql://")
conn = psycopg2.connect(URL, connect_timeout=15)
cur = conn.cursor()

print("=== row counts ===")
for table in ["iot_flood", "iot_landslide", "iot_predictions", '"IncomingReport"']:
    cur.execute(f"SELECT COUNT(*) FROM public.{table}")
    print(f"  {table:20s} {cur.fetchone()[0]}")

print("\n=== latest iot_flood ===")
cur.execute("""
    SELECT id, device_id, depth, temp, hum, recorded_at
    FROM iot_flood ORDER BY recorded_at DESC LIMIT 3
""")
for r in cur.fetchall():
    print(" ", r)

print("\n=== latest iot_landslide ===")
cur.execute("""
    SELECT id, device_id, moist, temp, hum, recorded_at
    FROM iot_landslide ORDER BY recorded_at DESC LIMIT 3
""")
for r in cur.fetchall():
    print(" ", r)

print("\n=== latest iot_predictions (most recent source) ===")
cur.execute("""
    SELECT source_id, disaster_type, horizon, predicted_status, predicted_at
    FROM iot_predictions
    WHERE source_id IN (
        SELECT source_id FROM iot_predictions ORDER BY predicted_at DESC LIMIT 1
    )
    ORDER BY horizon
""")
for r in cur.fetchall():
    print(" ", r)

print("\n=== latest IncomingReport ===")
cur.execute("""
    SELECT id, source, "disasterType", district, "sosId", "verificationStatus", "createdAt"
    FROM public."IncomingReport" ORDER BY "createdAt" DESC LIMIT 3
""")
for r in cur.fetchall():
    print(" ", r)

conn.close()
```

---

## Running the Full Test

```bash
# 1. Start services
docker compose up -d kafka j1-bridge-api j1-mqtt-forwarder j2-data-intelligence

# 2. Watch J2 logs in a second terminal (optional but useful)
docker logs -f j2-data-intelligence

# 3. Run smoke scripts from repo root
python scripts/smoke/pub_flood.py
python scripts/smoke/pub_landslide.py
python scripts/smoke/post_sos.py

# 4. Wait up to 35 s for the APScheduler ML cycle to run, then verify
python scripts/smoke/verify_db.py
```

---

## Expected Log Lines

After running the smoke scripts, `docker logs j2-data-intelligence` should contain:

```
# Sensor path
INFO:j2.kafka_consumer:iot_flood inserted: device=test-flood-XXXXXX depth=55.0
INFO:j2.kafka_consumer:iot_landslide inserted: device=test-slide-XXXXXX moist=2800

# ML pipeline (within 30 s)
INFO:app.services.iot_event_handler:[IoT-Flood] 1 new row(s), generating horizons [0, 1, 2, 3]
INFO:app.services.iot_event_handler:[IoT-Landslide] 1 new row(s), generating horizons [0, 1, 2, 3]

# SOS path
INFO:j2.kafka_consumer:IncomingReport inserted: sosId=<uuid> district=Colombo type=FLOOD
```

---

## Negative / Idempotency Checks

| Test | How | Expected |
|---|---|---|
| Re-send same SOS event | `post_sos.py` does this automatically | `HTTP 409` from j1-bridge-api, **no** second DB row |
| Unknown hazardType | Publish `{"type":"DROUGHT",…}` to HiveMQ | J2 logs `Skipping unsupported hazardType=DROUGHT`, no DB insert |
| Malformed JSON | Publish `not-json` to HiveMQ topic | J1 forwarder logs `Ignoring non-JSON payload`, no Kafka message |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `j2-data-intelligence` crash-loops on start | `DATABASE_URL` wrong / unreachable | Confirm URL uses the IPv4 pooler (`aws-1-ap-south-1.pooler.supabase.com:6543`), not the direct host |
| J1 forwarder: `on_disconnect() takes 3 to 4 args but 5 given` | paho-mqtt v2 callback signature mismatch | Cosmetic — forwarder reconnects and messages still flow; safe to ignore |
| Kafka topic not visible in Kafka UI | Topics auto-create on first produce | Publish at least one message first, then refresh |
| ML predictions not appearing after 30 s | Model `.pkl` files missing inside container | Run `docker exec j2-data-intelligence ls app/models/` — all four `.pkl` files must be present |
| `HTTP 422` from `/api/v1/ingest/report` | Missing required field or invalid value | Check `description` is ≥ 10 chars, `timestamp` is ISO 8601, `district` is non-empty |
| `Network is unreachable` in J2 logs | IPv6-only Supabase host used | Switch DATABASE_URL to the session pooler URL above |
