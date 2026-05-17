# Disaster Response System — Data Flow & Integration Analysis

> Last updated: 2026-05-16  
> Branch: `main_copy`  
> Database: Supabase (`db.qfhmczryyyddgitnlndy.supabase.co:5432`)

---

## 1. Architecture Overview

```
ESP32 Flood Node  ──┐
                    │ LoRa 433MHz
ESP32 Landslide ────┤
                    ▼
             Central Node (ESP32)
                    │ MQTT TLS :8883
                    ▼
         HiveMQ Cloud Broker
   (8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud)
                    │
                    ▼
         J1 MQTT Forwarder
         (normalises payload)
                    │
                    ▼  publishes to
         Kafka: j1.sensor.telemetry
                    │
                    ▼
         J2 Sensor Consumer
         → INSERT iot_flood / iot_landslide
         → APScheduler (every 30s) runs ML models
         → writes iot_predictions
         → publishes j2.engine.risk-alerts

Mobile App (Flutter)
  └─ Help Request / Disaster Report
       └─ SQLite queue → SyncService (every 30s)
              └─ POST /api/v1/ingest/report
                     ▼
              J1 Bridge API :8081
              (validates + idempotency check)
                     │ publishes to
                     ▼
              Kafka: j1.sos.raw-reports
                     │
                     ▼
              J2 Report Consumer
              → INSERT public."IncomingReport"
```

---

## 2. J1 Bridge API

### Entry point
`j1-device-edge/backend/app/main.py`

### Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check → `{"status":"ok"}` |
| POST | `/api/v1/ingest/report` | Receive SOS from mobile → Kafka |
| POST | `/api/v1/ingest/sensor` | Receive sensor telemetry → Kafka |
| GET | `/api/v1/resources` | Return emergency resources to mobile |
| GET | `/api/v1/debug/kafka-test` | Test Kafka connectivity |

### Config (`app/config.py`)

All values read from environment variables:

| Env var | Default (local) | Docker default |
|---------|----------------|----------------|
| `KAFKA_BOOTSTRAP_SERVERS` | `kafka:29092` | `kafka:29092` |
| `KAFKA_TOPIC_SOS_REPORTS` | `j1.sos.raw-reports` | `j1.sos.raw-reports` |
| `KAFKA_TOPIC_SENSOR_TELEMETRY` | `j1.sensor.telemetry` | `j1.sensor.telemetry` |
| `API_HOST` | `0.0.0.0` | `0.0.0.0` |
| `API_PORT` | `8081` | `8081` |
| `CORS_ORIGINS` | `*` | `*` |
| `IDEMPOTENCY_MAX_KEYS` | `50000` | `50000` |

> **Local dev override:** set `KAFKA_BOOTSTRAP_SERVERS=localhost:9092` when running J1 outside Docker.

### SOS Report Flow (`POST /api/v1/ingest/report`)

Source: Flutter `SyncService` polling SQLite queue every 30 seconds.

Payload sent by mobile app:
```json
{
  "eventId":     "uuid-v4",
  "deviceId":    "device-uuid",
  "timestamp":   "2026-05-16T12:00:00Z",
  "disasterType":"FLOOD",
  "district":    "Colombo",
  "latitude":    6.9271,
  "longitude":   79.8612,
  "description": "Help needed...",
  "contact":     "+94771234567",
  "mediaUrls":   []
}
```

What J1 does:
1. Checks in-memory `idempotency_store` (LRU, 50,000 keys) for duplicate `eventId` → 409 if found
2. Validates via `ReportIngestionValidator` → 422 if invalid
3. Stamps `source = "J1_SOS_APP"` and `createdAt = now(UTC)`
4. Publishes to Kafka topic `j1.sos.raw-reports` with `eventId` as the message key
5. Stores `eventId` in idempotency cache
6. Returns 201

Mobile response handling:
- `201` → marks event `SUBMITTED` in SQLite
- `409` → marks event `DUPLICATE` in SQLite (stops retrying)
- `400` / `422` → marks event `FAILED` in SQLite (stops retrying — bad payload)
- Any other error → keeps event `QUEUED`, retries on next poll (exponential backoff, max 5 attempts per session)

### Sensor Telemetry Flow (`POST /api/v1/ingest/sensor`)

Source: `J1 MQTT Forwarder` after normalising hardware MQTT payload.

Validation (`SensorIngestionValidator`):
- Accepts both mobile schema (`deviceId`, `hazardType`) and raw hardware schema (`id`, `type`)
- Generates `eventId` = `{deviceId}-{timestamp}-{hash8}` if not present
- Requires at least one of: `depth`, `temp`, `hum`, `moist`
- Publishes to Kafka topic `j1.sensor.telemetry`

### Kafka Producer (`app/kafka_producer.py`)

```
KafkaProducerService
  publish_sos_report(payload)    → j1.sos.raw-reports   (key = eventId)
  publish_sensor_telemetry(payload) → j1.sensor.telemetry (key = eventId)
```

Producer is a singleton (`kafka_producer`) initialised at import time. Uses `confluent_kafka.Producer` with `flush(timeout=10)` after each publish.

---

## 3. J1 MQTT Forwarder

### File
`j1-device-edge/backend/app/mqtt_http_forwarder.py`

### MQTT → Kafka pipeline

Subscribes to HiveMQ Cloud over TLS:
- Topic: `j1/disaster/flood`
- Topic: `j1/disaster/landslide`

On each message, `_normalise_payload()` maps the raw ESP32 payload to the standard sensor telemetry shape:

```python
{
  "eventId":   "{deviceId}-{now}-{hash8}",
  "deviceId":  payload["id"] or payload["deviceId"],
  "hazardType":"FLOOD" or "LANDSLIDE",
  "temp":      payload.get("temp"),
  "hum":       payload.get("hum"),
  "depth":     payload.get("depth"),     # flood only
  "moist":     payload.get("moist"),     # landslide only
  "ax/ay/az":  ...,                      # landslide only
  "gx/gy/gz":  ...,                      # landslide only
  "latitude":  payload.get("latitude"),
  "longitude": payload.get("longitude"),
  "timestamp": now (UTC ISO 8601),
  "raw_payload": { ...original... }
}
```

Then calls `kafka_producer.publish_sensor_telemetry(normalised)`.

### Env vars required

| Var | Value |
|-----|-------|
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` (local) or `kafka:29092` (Docker) |
| `MQTT_BROKER` | `8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud` |
| `MQTT_PORT` | `8883` |
| `MQTT_USERNAME` | `j1_gateway` |
| `MQTT_PASSWORD` | `8797Sudil` |
| `MQTT_TLS` | `true` |

---

## 4. J2 Data Intelligence Service

### Entry point
`j2-data-intelligence/app/main.py`

### Startup sequence

On `startup` event:
1. `Base.metadata.create_all()` — ensures all ORM tables exist in DB
2. APScheduler starts:
   - **Weather job** — daily at 02:00 UTC: fetches weather, runs ML forecast pipeline
   - **IoT poll job** — every 30 seconds: `run_iot_prediction_cycle()` — reads new `iot_flood`/`iot_landslide` rows, runs XGBoost/LightGBM, writes `iot_predictions`, triggers Moratuwa resource planner
3. Kafka sensor consumer thread starts (topic: `j1.sensor.telemetry`)
4. Kafka report consumer thread starts (topic: `j1.sos.raw-reports`)

### Config (`app/core/config.py`)

Reads from `j2-data-intelligence/.env`:

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `KAFKA_BROKER` | `localhost:9092` (local) or `kafka:29092` (Docker) |
| `KAFKA_TOPIC_SENSOR` | `j1.sensor.telemetry` |
| `KAFKA_TOPIC_SOS_REPORTS` | `j1.sos.raw-reports` |
| `KAFKA_CONSUMER_GROUP` | `j2-sensor-consumer` |
| `GEMINI_API_KEY` | Gemini API key for resource allocation agent |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `APP_HOST` / `APP_PORT` | `0.0.0.0` / `8082` |

### Kafka Consumers (`app/services/kafka_consumer.py`)

Two independent background threads:

**SensorConsumer** — group `j2-sensor-consumer`
- Topic: `j1.sensor.telemetry`
- On each message: inserts into `iot_flood` or `iot_landslide` based on `hazardType`
- Idempotent: `ON CONFLICT (id) DO NOTHING`

**ReportConsumer** — group `j2-report-consumer`
- Topic: `j1.sos.raw-reports`
- On each message: checks for duplicate `sosId`, then inserts into `public."IncomingReport"`
- Idempotent: `ON CONFLICT ("sosId") DO NOTHING`
- **Critical:** `mediaUrls` must be passed as a Python `list` (not `json.dumps()`) — the column is `text[]` (Postgres array), not JSON

### IoT Prediction Cycle (`app/services/iot_event_handler.py`)

Runs every 30 seconds:
1. Reads latest unprocessed rows from `iot_flood` / `iot_landslide`
2. Runs XGBoost/LightGBM models → 4-class output: `Normal`, `Moderate`, `Severe`, `Extreme`
3. Writes results to `iot_predictions`
4. If status ≠ Normal: calls `trigger_moratuwa_resource_plan()` → Gemini LLM → writes `ResourcePlan`

### API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | Health check → `{"status":"healthy"}` |
| POST | `/api/v1/engine/trigger` | Manually trigger forecast pipeline |
| POST | `/api/v1/intelligence/agent/allocate` | Gemini resource allocation agent |

---

## 5. `IncomingReport` Table

### Schema (Supabase)

```sql
CREATE TABLE public."IncomingReport" (
    id                   UUID PRIMARY KEY,
    source               report_source NOT NULL,       -- 'J1_SOS_APP'
    "disasterType"       disaster_type NOT NULL,       -- 'FLOOD'|'LANDSLIDE'|'DROUGHT'
    district             VARCHAR NOT NULL,
    latitude             DOUBLE PRECISION NOT NULL,
    longitude            DOUBLE PRECISION NOT NULL,
    description          TEXT NOT NULL,
    contact              VARCHAR,
    "mediaUrls"          TEXT[],                       -- Postgres text array, NOT JSON
    "verificationStatus" verification_status NOT NULL DEFAULT 'PENDING_REVIEW',
    "deviceId"           VARCHAR,
    "createdAt"          TIMESTAMPTZ NOT NULL,
    "sosId"              VARCHAR UNIQUE,               -- eventId from mobile, idempotency key
    "officerNotes"       TEXT,
    "reviewedById"       UUID REFERENCES "User"(id),
    "reviewedAt"         TIMESTAMPTZ,
    "incidentId"         UUID REFERENCES "ConfirmedIncident"(id)
);
```

### Codebase references

| File | Usage |
|------|-------|
| `j2-data-intelligence/app/services/kafka_consumer.py` | INSERT + duplicate-check |
| `j3-system-interaction/dms/prisma/schema.prisma` | Prisma model (J3 owns schema) |
| `j3-system-interaction/dms/app/dashboard/incoming-reports/page.tsx` | UI display |
| `j1-device-edge/mobile_app/databaseforreference.prisma` | Reference copy |

### Required one-time DB setup

```sql
-- Run once in Supabase SQL editor
ALTER TABLE public."IncomingReport"
  ADD CONSTRAINT incoming_report_sos_id_unique UNIQUE ("sosId");
```

---

## 6. IoT Tables

### `iot_flood`

| Column | Type | Source |
|--------|------|--------|
| `id` | TEXT (PK) | UUID generated by J2 consumer |
| `type` | TEXT | `"FLOOD"` |
| `temp` | FLOAT | ESP32 sensor |
| `hum` | FLOAT | ESP32 sensor |
| `depth` | FLOAT | ESP32 flood depth (metres) |
| `device_id` | TEXT | ESP32 node ID (e.g. `J1_TX_01`) |
| `recorded_at` | TIMESTAMPTZ | Sensor timestamp |
| `created_at` | TIMESTAMPTZ | DB insert time |
| `topic` | TEXT | MQTT topic (e.g. `j1/disaster/flood`) |
| `raw_payload` | JSONB | Full original MQTT JSON |

### `iot_landslide`

| Column | Type | Source |
|--------|------|--------|
| `id` | TEXT (PK) | UUID generated by J2 consumer |
| `type` | TEXT | `"LANDSLIDE"` |
| `temp` | FLOAT | ESP32 sensor |
| `hum` | FLOAT | ESP32 sensor |
| `moist` | FLOAT | Soil moisture (raw ADC) |
| `ax` / `ay` / `az` | FLOAT | Accelerometer (m/s²) |
| `gx` / `gy` / `gz` | FLOAT | Gyroscope (°/s) |
| `device_id` | TEXT | ESP32 node ID (e.g. `J1_TX_02`) |
| `recorded_at` | TIMESTAMPTZ | Sensor timestamp |
| `created_at` | TIMESTAMPTZ | DB insert time |
| `topic` | TEXT | MQTT topic |
| `raw_payload` | JSONB | Full original MQTT JSON |

### `iot_predictions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT (PK) | UUID |
| `source_id` | TEXT | FK → `iot_flood.id` or `iot_landslide.id` |
| `disaster_type` | TEXT | `FLOOD` or `LANDSLIDE` |
| `predicted_status` | TEXT | `Normal` / `Moderate` / `Severe` / `Extreme` |
| `horizon` | INT | 0=now, 1=Day+1, 2=Day+2, 3=Day+3 |
| `predicted_at` | DATETIME | When the model ran |

Unique constraint: `(source_id, disaster_type, horizon)`

---

## 7. Kafka Topics

| Topic | Producer | Consumer | Table written |
|-------|----------|----------|---------------|
| `j1.sos.raw-reports` | J1 Bridge API | J2 report consumer (group: `j2-report-consumer`) | `IncomingReport` |
| `j1.sensor.telemetry` | J1 MQTT Forwarder | J2 sensor consumer (group: `j2-sensor-consumer`) | `iot_flood` / `iot_landslide` |
| `j2.engine.risk-alerts` | J2 IoT prediction cycle | J3 event bridge (not yet wired) | — |

---

## 8. Known Issues & Outstanding Work

### Fixed in `main_copy` branch

| Issue | Fix |
|-------|-----|
| `mediaUrls` INSERT failed silently — `json.dumps([])` passed to `text[]` column | Pass Python list directly: `media_urls` not `json.dumps(media_urls)` |
| `ON CONFLICT DO NOTHING` had no unique column to conflict on | Added `UNIQUE ("sosId")` constraint + changed to `ON CONFLICT ("sosId") DO NOTHING` |
| `Division.name` column error in resource planner and allocation agent | Changed to `Division.division_name` to match ORM model |
| Mobile app sent `district = "Unknown"` or raw GPS coordinates | Added district dropdown (25 Sri Lanka districts) to Flutter form |

### Still outstanding

| Issue | Notes |
|-------|-------|
| J3 event bridge not consuming `j2.engine.risk-alerts` | Live ML alerts do not appear on dashboard yet |
| `j2-data-intelligence/docker-compose.yml` starts conflicting Kafka | File should be deleted or marked as deprecated — do not run it |
| J2 `.env.example` still has Docker-internal `DATABASE_URL` | Misleading for new developers — must be replaced with Supabase URL |

---

## 9. Environment Variables — Full Reference

### J1 Bridge API

| Var | Local value | Docker value |
|-----|-------------|--------------|
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | `kafka:29092` |
| `KAFKA_TOPIC_SOS_REPORTS` | `j1.sos.raw-reports` | `j1.sos.raw-reports` |
| `KAFKA_TOPIC_SENSOR_TELEMETRY` | `j1.sensor.telemetry` | `j1.sensor.telemetry` |
| `API_HOST` | `0.0.0.0` | `0.0.0.0` |
| `API_PORT` | `8081` | `8081` |
| `CORS_ORIGINS` | `*` | `*` |
| `IDEMPOTENCY_MAX_KEYS` | `50000` | `50000` |

### J1 MQTT Forwarder

| Var | Value |
|-----|-------|
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` (local) or `kafka:29092` (Docker) |
| `MQTT_BROKER` | `8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud` |
| `MQTT_PORT` | `8883` |
| `MQTT_USERNAME` | `j1_gateway` |
| `MQTT_PASSWORD` | `8797Sudil` |
| `MQTT_TLS` | `true` |

### J2 Data Intelligence

| Var | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://postgres:<pass>@db.qfhmczryyyddgitnlndy.supabase.co:5432/postgres` |
| `KAFKA_BROKER` | `localhost:9092` (local) or `kafka:29092` (Docker) |
| `KAFKA_TOPIC_SENSOR` | `j1.sensor.telemetry` |
| `KAFKA_TOPIC_SOS_REPORTS` | `j1.sos.raw-reports` |
| `KAFKA_CONSUMER_GROUP` | `j2-sensor-consumer` |
| `GEMINI_API_KEY` | Gemini API key |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `APP_HOST` | `0.0.0.0` |
| `APP_PORT` | `8082` |
| `LOG_LEVEL` | `INFO` |
