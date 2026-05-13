# Disaster Response System — Data Flow & Integration Analysis

> Generated: 2026-05-12  
> Branch: `refactorbranch`  
> Database: Supabase (IPv4 pooler — `aws-1-ap-south-1.pooler.supabase.com:6543`)

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
         ┌──────────┴──────────┐
         ▼                     ▼
  j1-mqtt-http-forwarder    (same service, two actions)
  ① Supabase REST insert     ② Forward to j1-bridge-api
  → iot_flood                   POST /api/v1/ingest/sensor
  → iot_landslide                      │
                                        ▼
                               j2-data-intelligence
                               POST /api/v1/ingest/sensor
                               → INSERT iot_flood / iot_landslide

Mobile App (Flutter)
  └─ SOS / Disaster Report
       └─ POST /api/v1/ingest/report
              ▼
       j1-bridge-api  (validates, adds source + createdAt)
              │  Bearer dev-secret-token
              ▼
       j2-data-intelligence
       POST /api/v1/ingest/report
       → INSERT public."IncomingReport"
```

---

## 2. Prompt 1 — J2 Auth Middleware

### Location
`j2-data-intelligence/app/api/ingest.py` — no separate middleware directory. Auth is a FastAPI `Depends` guard on every ingest endpoint.

### How It Works

```python
# File: j2-data-intelligence/app/api/ingest.py  line 27
INTERNAL_TOKEN = os.getenv("J1_INTERNAL_TOKEN", "dev-secret-token")

def verify_internal_auth(
    authorization: str | None = Header(default=None, alias="Authorization")
) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, {"error": "Missing bearer token"})
    token = authorization.split(" ", 1)[1].strip()
    if token != INTERNAL_TOKEN:
        raise HTTPException(401, {"error": "Invalid internal token"})
```

Applied via `Depends` on both endpoints:
```python
@router.post("/report", ...)
async def ingest_report(..., _: None = Depends(verify_internal_auth), ...):

@router.post("/sensor", ...)
async def ingest_sensor(..., _: None = Depends(verify_internal_auth), ...):
```

### Token Chain (J1 → J2)

| Side | Env var | Default | docker-compose value |
|------|---------|---------|----------------------|
| J2 expects | `J1_INTERNAL_TOKEN` | `dev-secret-token` | `${INTERNAL_SERVICE_TOKEN}` |
| J1 sends | `J2_SECRET_TOKEN` | `dev-secret-token` | `${INTERNAL_SERVICE_TOKEN}` |

**Current `.env`:** `INTERNAL_SERVICE_TOKEN=dev-secret-token`

J1 sets the header at client init time (`j2_client.py` line 34–36):
```python
token = (settings.J2_SECRET_TOKEN or "").strip()
if token:
    headers["Authorization"] = f"Bearer {token}"
```

**Bug that caused 401 loops:** `INTERNAL_SERVICE_TOKEN` was missing from `.env`, so docker-compose resolved it to empty string `""`. J1 sent no `Authorization` header → J2 rejected with 401 → J1 mapped any non-201/409/422 to 503. Fixed by adding `INTERNAL_SERVICE_TOKEN=dev-secret-token` to `.env`.

---

## 3. Prompt 2 — J1 SOS / Report Flow

### Entry Point
`j1-device-edge/backend/app/routes/events.py`

### Route: `POST /api/v1/ingest/report`

**Source:** Mobile app Flutter `SyncService` polling SQLite queue every 5 seconds.

**Payload sent by mobile app (from `offline_queue_manager.dart`):**
```json
{
  "eventId": "<uuid>",
  "disasterType": "FLOOD | LANDSLIDE | DROUGHT",
  "district": "Colombo",
  "latitude": 6.927,
  "longitude": 79.861,
  "description": "Help needed...",
  "contact": "+94771234567",
  "mediaUrls": [],
  "deviceId": "<device-uuid>"
}
```

**What J1 does:**
1. Checks local in-memory `idempotency_store` (LRU 50,000 keys) for duplicate `eventId`
2. Validates via `ReportIngestionValidator`
3. Stamps `source = "J1_SOS_APP"` and `createdAt = now(UTC)`
4. Forwards to J2 `POST /api/v1/ingest/report` via `j2_client` with Bearer token
5. On 201: marks event in local idempotency cache, returns 201 to mobile
6. On 409: marks as duplicate, returns 409 (mobile marks as DUPLICATE)
7. On failure: returns 503 (mobile retries with exponential backoff)

**J1 does NOT write to Supabase directly for reports.** All report writes go through J2.

### Route: `POST /api/v1/ingest/sensor`

Used by `j1-mqtt-http-forwarder` to pass MQTT sensor data through J1 into J2.

**Payload from MQTT (Central Node):**
```json
{ "id": "J1_TX_01", "type": "FLOOD", "temp": 28.5, "hum": 65.0, "depth": 1.23 }
{ "id": "J1_TX_02", "type": "LANDSLIDE", "temp": 25.0, "hum": 70.0, "moist": 512,
  "ax": 0.15, "ay": -0.02, "az": 9.81, "gx": 0.01, "gy": 0.02, "gz": 0.00 }
```

**What J1 does:**
1. Calls `SensorIngestionValidator.validate()` which normalizes the raw payload:
   - Maps `id` → `deviceId`
   - Maps `type` → `hazardType`
   - Generates `eventId` = `{deviceId}-{timestamp}-{hash}`
   - Sets `timestamp` = now if not present
2. Adds `type = hazardType` and `recorded_at = timestamp`
3. Forwards to J2 `POST /api/v1/ingest/sensor`

---

## 4. Prompt 3 — `IncomingReport` Table

### Codebase References

| File | Usage |
|------|-------|
| `j2-data-intelligence/app/api/ingest.py` | INSERT and duplicate-check SELECT |
| `j2-data-intelligence/migrations/001_additive_j2_schema.sql` | CREATE TABLE IF NOT EXISTS |
| `j3-system-interaction/dms/prisma/schema.prisma` | Prisma model definition (J3 owns schema) |
| `j3-system-interaction/dms/prisma/create_incidents_and_resources.sql` | J3 SQL migration |
| `j3-system-interaction/dms/app/dashboard/incoming-reports/page.tsx` | UI display page |
| `j1-device-edge/mobile_app/databaseforreference.prisma` | Reference schema copy |

### Table Schema (as created by migration)

```sql
CREATE TABLE IF NOT EXISTS public."IncomingReport" (
    id                  VARCHAR PRIMARY KEY,
    source              VARCHAR NOT NULL,           -- "J1_SOS_APP"
    "disasterType"      VARCHAR NOT NULL,           -- "FLOOD" | "LANDSLIDE" | "DROUGHT"
    district            VARCHAR NOT NULL,
    latitude            DOUBLE PRECISION NOT NULL,
    longitude           DOUBLE PRECISION NOT NULL,
    description         TEXT NOT NULL,
    contact             VARCHAR,
    "mediaUrls"         TEXT[],
    "verificationStatus" VARCHAR NOT NULL DEFAULT 'PENDING_REVIEW',
    "deviceId"          VARCHAR,
    "createdAt"         TIMESTAMPTZ NOT NULL,
    "sosId"             VARCHAR UNIQUE,             -- client eventId, idempotency key
    inserted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### J2 Insert (from `ingest.py` lines 135–163)

```python
INSERT INTO public."IncomingReport"
(id, source, "disasterType", district, latitude, longitude,
 description, contact, "mediaUrls", "verificationStatus", "deviceId", "createdAt", "sosId")
VALUES
(:id, :source, :disasterType, :district, :latitude, :longitude,
 :description, :contact, :mediaUrls, 'PENDING_REVIEW', :deviceId, :createdAt, :sosId)
```

Duplicate check:
```sql
SELECT id FROM public."IncomingReport" WHERE "sosId" = :eventId LIMIT 1;
```

### J2 App Directory Structure

```
j2-data-intelligence/app/
├── main.py                         FastAPI entry, APScheduler (daily 02:00 UTC)
├── api/
│   ├── ingest.py                   POST /api/v1/ingest/report  and  /sensor
│   └── routes.py                   GET  /api/v1/health, predictions, etc.
├── db/
│   ├── database.py                 SQLAlchemy engine (DATABASE_URL env)
│   └── models.py                   ORM models
├── services/
│   ├── event_manager.py            In-process pub/sub (DATA_FETCHED event)
│   ├── model_predictor.py          Load .pkl ensemble models
│   ├── prediction_engine.py        3-day forecast pipeline
│   ├── risk_pipeline.py            Raw telemetry → predictions
│   ├── feature_engineering.py      rain_lag, rolling averages, SPI, seasonal
│   ├── weather_fetcher.py          External weather data
│   ├── recommendation_service.py   Resource allocation recommendations
│   ├── kafka_consumer.py           (legacy, unused)
│   └── kafka_producer.py           (legacy, unused)
└── models/
    ├── Drought_ensemble.pkl
    ├── Flood_ensemble.pkl
    └── Landslide_ensemble.pkl
```

---

## 5. Prompt 4 — Forwarder Supabase Writer

### File
`j1-device-edge/backend/app/mqtt_http_forwarder.py`

### Topic → Table Routing (`_route_table_for_topic`, line 150)

```python
def _route_table_for_topic(topic: str) -> str | None:
    normalized = (topic or "").strip().lower()
    if normalized == "j1/disaster/flood":
        return "iot_flood"
    if normalized == "j1/disaster/landslide":
        return "iot_landslide"
    return None               # other topics silently dropped
```

### Payload Builder for Supabase REST (`_insert_via_supabase_rest`, line 196)

```python
body: dict = {
    "device_id": device_id,   # from payload["id"] or payload["deviceId"]
    "topic":     topic,        # e.g. "j1/disaster/flood"
    "type":      hazard_type,  # payload["type"]  e.g. "FLOOD"
    "raw_payload": payload,    # full original JSON from MQTT
}

# Common to both tables
if "temp" in payload:  body["temp"] = payload["temp"]
if "hum"  in payload:  body["hum"]  = payload["hum"]
if recorded_at:        body["recorded_at"] = recorded_at.isoformat()

# iot_flood only
if table == "iot_flood":
    if "depth" in payload:
        body["depth"] = payload["depth"]

# iot_landslide only
elif table == "iot_landslide":
    for key in ("moist", "ax", "ay", "az", "gx", "gy", "gz"):
        if key in payload:
            body[key] = payload[key]
```

### Supabase REST Headers (`_supabase_headers`, line 182)

```python
{
    "apikey":          SUPABASE_SERVICE_ROLE_KEY,
    "Authorization":   f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type":    "application/json",
    "Prefer":          "return=minimal",
    "Content-Profile": "public",
    "Accept-Profile":  "public",
}
```

POST to: `https://<project>.supabase.co/rest/v1/iot_flood` or `.../iot_landslide`

---

## 6. Current Table Schema in Supabase (After Fixes)

### `public.iot_flood`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text | legacy PK (pre-existing) |
| `type` | text | "FLOOD" |
| `temp` | double precision | °C |
| `hum` | double precision | % |
| `depth` | double precision | metres |
| `created_at` | timestamptz | legacy |
| `device_id` | text | added — "J1_TX_01" |
| `topic` | text | added — "j1/disaster/flood" |
| `raw_payload` | jsonb | added — full MQTT JSON |
| `recorded_at` | timestamptz | added — sensor timestamp |

### `public.iot_landslide`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text | legacy PK |
| `type` | text | "LANDSLIDE" |
| `temp` | double precision | °C |
| `hum` | double precision | % |
| `moist` | double precision | soil moisture (raw ADC) |
| `ax` / `ay` / `az` | double precision | accelerometer m/s² |
| `gx` / `gy` / `gz` | double precision | gyroscope °/s |
| `created_at` | timestamptz | legacy |
| `device_id` | text | added |
| `topic` | text | added |
| `raw_payload` | jsonb | added |
| `recorded_at` | timestamptz | added |

> **Note:** The pre-existing `iot_flood` and `iot_landslide` tables had integer types for numeric sensor columns. These were altered to `DOUBLE PRECISION` to accept float values from the sensors (e.g. `az = 9.81`, `moist = 512.0`).

---

## 7. Known Issues & Outstanding Fixes

### Issue 1 — J1→J2 sensor forward still returns 503

**Root cause:** J2 `ingest_sensor` does `SELECT row_id FROM public.{target_table}` for duplicate check, but the pre-existing `iot_flood` / `iot_landslide` tables have no `row_id` column — they use `id` as PK.

**Fix needed in `j2-data-intelligence/app/api/ingest.py`:**
```python
# Change duplicate check from:
SELECT row_id FROM public.{target_table} WHERE device_id = ...
# To (use existing PK column 'id' or no PK constraint — use recorded_at only):
SELECT id FROM public.{target_table} WHERE device_id = :device_id AND recorded_at = :recorded_at LIMIT 1;
```

And change `RETURNING row_id` → `RETURNING id` in the INSERT queries.

### Issue 2 — J2 INSERT missing `id` column (NOT NULL)

The pre-existing tables have `id TEXT` as the primary key with no default. The INSERT in J2 does not supply `id`. Fix: add `"id": str(uuid4())` to the INSERT body, or add a server-side default in Supabase.

### Issue 3 — Forwarder `_forward_sensor_payload` sends to J1 without Bearer token

`_forward_sensor_payload` does a plain `httpx.Client.post()` with no Authorization header. J1's `/api/v1/ingest/sensor` currently has no auth guard, so this works. But if auth is ever added to J1, this will break. Not an immediate issue.

---

## 8. Environment Variables Reference

| Variable | Service | Value |
|----------|---------|-------|
| `DATABASE_URL` | j2, j1-forwarder | `postgresql://postgres.qfhmczryyyddgitnlndy:...@aws-1-ap-south-1.pooler.supabase.com:6543/postgres` |
| `SUPABASE_URL` | j1-forwarder | `https://qfhmczryyyddgitnlndy.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | j1-forwarder | `eyJ...` (service role — bypasses RLS) |
| `SUPABASE_ANON_KEY` | j1-forwarder | `eyJ...` (fallback if service key absent) |
| `INTERNAL_SERVICE_TOKEN` | j1-bridge, j2 | `dev-secret-token` |
| `J1_INTERNAL_TOKEN` | j2 | read from `INTERNAL_SERVICE_TOKEN` |
| `J2_SECRET_TOKEN` | j1-bridge | read from `INTERNAL_SERVICE_TOKEN` |
| `MQTT_BROKER` | j1-forwarder | `8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud` |
| `MQTT_PORT` | j1-forwarder | `8883` (TLS) |
| `MQTT_USERNAME` | j1-forwarder | `j1_gateway` |
| `MQTT_PASSWORD` | j1-forwarder | `8797Sudil` |
