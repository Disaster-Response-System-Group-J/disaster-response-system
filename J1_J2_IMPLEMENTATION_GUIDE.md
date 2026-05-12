# J1-J2 Integration Implementation Guide

**Status**: Ready for Implementation  
**Date**: 2026-05-12  
**Scope**: Remove Kafka, Replace with HTTP Ingestion, Simplify Architecture

---

## QUICK START

### Prerequisites

- Docker + Docker Compose
- Postgres database running (with schema from `ARCHITECTURE_REFACTOR_PLAN.md`)
- Python 3.11+

### J1 Setup (5 minutes)

```bash
cd j1-device-edge/backend

# Install new dependencies (removed Kafka, added httpx)
pip install -r requirements.txt

# Set environment variables
export J2_BASE_URL=http://j2:8082
export J2_SECRET_TOKEN=dev-secret-token
export CORS_ORIGINS="*"

# Run J1
uvicorn app.main:app --reload --port 8081
```

**New Endpoints:**
- `POST /api/v1/ingest/report` — Accept disaster reports
- `POST /api/v1/ingest/sensor` — Accept sensor readings
- `GET /api/v1/ingest` — Health check (debug)

### J2 Setup (5 minutes)

```bash
cd j2-data-intelligence

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL=postgresql://user:pass@postgres:5432/disaster_db

# Run J2
uvicorn app.main:app --reload --port 8082
```

**New Endpoints:**
- `POST /api/v1/ingest/report` — Ingest reports (idempotent)
- `POST /api/v1/ingest/sensor` — Ingest sensor data (idempotent)
- `GET /api/v1/incidents` — List incidents
- `GET /api/v1/alerts` — List active alerts
- `GET /api/v1/health` — Health check

---

## FILE CHANGES SUMMARY

### J1 Files Changed

| File | Change | Reason |
|------|--------|--------|
| `requirements.txt` | Removed `confluent-kafka`, added `httpx` | Kafka → HTTP |
| `app/config.py` | Added J2 settings | Configure J2 client |
| `app/models.py` | Added `ReportIngestPayload`, `SensorIngestPayload` | New schemas |
| `app/main.py` | Use `j2_client` instead of `kafka_producer` | Lifecycle management |
| `app/routes/events.py` | Complete rewrite → `/ingest/{report,sensor}` | New endpoints |
| `app/j2_client.py` | NEW | HTTP client to J2 with retry |
| `app/validation.py` | NEW | Field validation logic |

### J2 Files Changed

| File | Change | Reason |
|------|--------|--------|
| `app/api/ingest.py` | NEW | Handle ingestion from J1 |
| `app/api/routes.py` | Added `/incidents`, `/alerts` | Read APIs |
| `app/main.py` | Include `ingest_router` | Register routes |

### Database Changes

**CRITICAL: Run these migrations before deploying**

```sql
-- 1. Add UNIQUE constraint to IncomingReport for idempotency
ALTER TABLE public."IncomingReport" ADD UNIQUE ("eventId");

-- 2. Add UNIQUE constraint to iot_rainfall_data for deduplication
CREATE UNIQUE INDEX iot_rainfall_data_dedup ON public."iot_rainfall_data" (id, recorded_at);

-- 3. Verify enum consistency (FLOOD, LANDSLIDE, DROUGHT)
-- Check that all disaster types use consistent enum values
```

---

## INTEGRATION FLOW

### Report Ingestion Flow

```
1. Mobile App
   ↓ HTTPS POST
2. J1 /api/v1/ingest/report
   - Verify Idempotency-Key
   - Validate fields (required, enum, range)
   - Normalize payload
   - Upload media to S3 (if present)
   - Record in idempotency store (local memory)
   ↓ HTTPS POST (with retry on 503)
3. J2 /api/v1/ingest/report
   - Verify J1 authorization token
   - INSERT INTO IncomingReport (ON CONFLICT DO NOTHING)
   - If duplicate → return 409
   - If success → return 201 with report ID
   ↓ Response to Mobile
4. Mobile App receives 201
   - Remove from offline queue
   - Show success to user
   OR receives 409
   - Already submitted, mark done
   OR receives 503
   - Keep in queue, retry in 30 seconds
```

### Sensor Ingestion Flow

```
1. IoT Device / Mobile Sensor
   ↓ HTTPS POST
2. J1 /api/v1/ingest/sensor
   - Same validation/normalization as report
   ↓ HTTPS POST
3. J2 /api/v1/ingest/sensor
   - INSERT INTO iot_rainfall_data (ON CONFLICT DO NOTHING)
   - Check threshold (depth > 1.0m) → generate alert if exceeded
   - Return 201 with alert_triggered flag
   ↓ Response + optional Alert
4. Mobile App / Dashboard receives alert
```

---

## VALIDATION RULES

### Report Ingestion (J1)

```python
ReportIngestPayload(
    eventId: str,                   # UUID v4 for dedup
    timestamp: str,                 # ISO 8601, required
    deviceId: str,                  # Mobile device ID, required
    disasterType: str,              # FLOOD|LANDSLIDE|DROUGHT, required
    district: str,                  # District name, required
    latitude: float,                # Valid range [-90, 90], required
    longitude: float,               # Valid range [-180, 180], required
    description: str,               # Min 10 chars, required
    contact: str | None,            # Phone with 5+ digits, optional
    mediaUrls: list[str] | None,    # Max 5, HTTPS only, optional
)
```

**Validation Errors (422):**
```json
{
  "success": false,
  "error": "Validation failed",
  "errors": [
    {"field": "description", "reason": "Minimum 10 characters"},
    {"field": "latitude", "reason": "Must be between -90 and 90"}
  ]
}
```

### Sensor Ingestion (J1)

```python
SensorIngestPayload(
    eventId: str,                   # UUID v4, required
    timestamp: str,                 # ISO 8601, required
    deviceId: str,                  # Sensor ID, required
    hazardType: str,                # FLOOD|LANDSLIDE|DROUGHT, required
    depth: float | None,            # Meters, optional, >= 0
    temperature: float | None,      # Celsius, optional, [-50, 60]
    humidity: float | None,         # Percentage, optional, [0, 100]
    moisture: float | None,         # Percentage, optional, [0, 100]
    latitude: float | None,         # GPS, optional
    longitude: float | None,        # GPS, optional
    division_id: int | None,        # For lookup, optional
)
```

**Validation Rules:**
- At least ONE of: depth, temperature, humidity, moisture
- If latitude provided, longitude also required (and vice versa)
- All numeric fields must be in valid range

---

## HTTP STATUS CODES

### J1 → Mobile

| Code | Scenario | Action |
|------|----------|--------|
| `201` | Success | Remove from queue, show success |
| `409` | Duplicate | Already submitted, mark complete |
| `422` | Validation error | Show field errors to user, don't retry |
| `503` | J2 down | Keep in queue, retry in 30 seconds |
| `400` | Bad request | Log, don't retry (shouldn't happen) |

### J2 → J1

| Code | Scenario | Action |
|------|----------|--------|
| `201` | Inserted | Return success to mobile |
| `409` | Duplicate | Log, return conflict to mobile |
| `422` | Validation | Return error to mobile |
| `500` | Internal error | Return 503 to mobile (retry) |

---

## IDEMPOTENCY STRATEGY

### Database-Level Idempotency

**Reports:**
```sql
ALTER TABLE "IncomingReport" ADD UNIQUE ("eventId");
-- If eventId exists, INSERT ... ON CONFLICT DO NOTHING
-- Result: No duplicate rows, safe to retry
```

**Sensors:**
```sql
CREATE UNIQUE INDEX iot_rainfall_data_dedup ON iot_rainfall_data (id, recorded_at);
-- If (id, recorded_at) exists, INSERT ... ON CONFLICT DO NOTHING
-- Result: No duplicate rows, safe to retry
```

### J1 Local Idempotency Store

- In-memory cache of recently seen eventIds
- Max 50,000 entries (configurable)
- Prevents duplicate checks in J2 if J1 receives same event twice
- If J2 is slow/down, J1 can still fast-reject duplicates locally

### Mobile Offline Queue

- Generate eventId on device (UUID v4)
- Store (eventId, payload, timestamp) in SQLite
- On sync:
  - If 201: delete from queue
  - If 409: delete from queue (already sent)
  - If 422: delete from queue (bad data, show error)
  - If 503: keep in queue, retry later

---

## RETRY LOGIC

### J1 → J2 Retry

```python
# exponential backoff: 1s, 2s, 4s, max 3 retries
retries = 0
backoff = 1.0

while retries < 3:
    try:
        response = await j2_client.ingest_report(payload)
        return response
    except (ConnectionError, TimeoutError, 503, 504, 408):
        retries += 1
        if retries >= 3:
            raise  # Return 503 to mobile
        await asyncio.sleep(backoff)
        backoff *= 2

# Mobile retries with exponential backoff on 503
# Keep in offline queue, retry in 30 seconds
```

---

## SENSOR THRESHOLD ALERTS

### Simple Threshold Logic (J2)

```python
# In ingest_sensor endpoint
if payload.depth > 1.0:  # Threshold: 1.0 meters
    alert_data = {
        "type": "FLOOD_THRESHOLD_EXCEEDED",
        "severity": "HIGH" if depth > 1.5 else "MEDIUM",
        "message": f"Water depth {depth}m at {deviceId}"
    }
    # Insert into Alert table or risk_alert_events
    return {"alert_triggered": True, "alert": alert_data}
```

**NO complex ML, NO Celery, NO Redis — just if-then logic.**

---

## MEDIA HANDLING

### Mobile → J1 Upload Flow

1. Mobile captures photo/file
2. On report submit:
   - Upload to S3/bucket with key: `{eventId}/{filename}`
   - Get HTTPS URL: `https://bucket.s3/eventId/filename`
   - Include in `mediaUrls` array in payload
3. J1 validation:
   - Verify all URLs are HTTPS
   - Validate URL format
   - Forward to J2
4. J2 stores as-is (trusts J1)
5. Postgres stores JSON array: `["https://bucket.s3/event-id-1/photo.jpg"]`

### Offline Sync

- Mobile SQLite stores: `(eventId, report_payload, media_file_refs)`
- Media file refs: local paths `/data/photos/photo-123.jpg`
- On sync:
  - Upload media first (get HTTPS URLs)
  - Include URLs in payload
  - Send to J1

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment

- [ ] Database migrations applied (unique constraints)
- [ ] J1 and J2 dependencies installed (`pip install -r requirements.txt`)
- [ ] Environment variables configured
- [ ] J2 health check: `GET /api/v1/health` → 200
- [ ] Kafka completely removed from codebase (verify)

### Deployment

- [ ] Deploy J2 first (must be ready before J1 forwards)
- [ ] Deploy J1 (will forward to J2)
- [ ] Verify: `POST /api/v1/ingest/report` returns 201
- [ ] Verify: Duplicate returns 409
- [ ] Verify: Invalid payload returns 422

### Post-Deployment

- [ ] Monitor logs: look for J2 connection errors
- [ ] Test end-to-end: mobile → J1 → J2 → Postgres
- [ ] Verify incidents appear in dashboard
- [ ] Verify sensor alerts trigger

---

## TROUBLESHOOTING

### J1 Can't Reach J2

```
Error: "J2 service unavailable. Please retry in 5 seconds."
```

**Check:**
```bash
# From J1 pod/container
curl -H "Authorization: Bearer dev-secret-token" \
  http://j2:8082/api/v1/health

# If DNS fails, update J2_BASE_URL in J1 config
# If auth fails, verify J2_SECRET_TOKEN matches
```

### Duplicate eventId Rejected (409)

**This is expected.** Means:
1. Mobile retried (good)
2. J2 already has it (good)
3. No duplicates in DB (good)

Check logs to distinguish:
- J1 local idempotency: "Duplicate ... rejected (local)"
- J2 database idempotency: "Duplicate ... already exists"

### Validation Error (422)

```json
{
  "error": "Validation failed",
  "errors": [{"field": "description", "reason": "Minimum 10 characters"}]
}
```

**Fix:** Mobile must send valid payload. This is NOT a retry case — it's bad data.

### Sensor Threshold Not Triggering

Check:
1. Is depth value being sent? (`null` skips threshold check)
2. Is depth > 1.0? (threshold is 1.0m)
3. Check J2 logs: "Flood threshold exceeded: ..."

---

## MONITORING

### Key Metrics

```bash
# J1 Metrics
- Ingestion rate (reports/sec, sensors/sec)
- Validation error rate (%)
- J2 retry rate (%)
- Idempotency hit rate (%)

# J2 Metrics
- DB write latency (ms)
- Duplicate rate (%)
- Alert trigger rate (%)
- J1 auth failures

# Database Metrics
- Unique constraint violations
- Insert latency (ms)
- Deadlocks (should be zero)
```

### Log Patterns

**J1 Healthy:**
```
[j1.events] Report accepted: eventId=550e8400... district=Colombo
[j1.j2_client] J2 response: 201 for /api/v1/ingest/report
```

**J1 Error:**
```
[j1.j2_client] J2 connection error: TimeoutException (attempt 1/3)
[j1.j2_client] Retrying J2 request in 1.0 seconds
```

**J2 Healthy:**
```
[j2.ingest] Report ingested: id=uuid eventId=550e8400... district=Colombo
```

**J2 Duplicate:**
```
[j2.ingest] Duplicate report rejected: eventId=550e8400...
```

---

## ROLLBACK

If needed to revert to Kafka:

1. Restore old `requirements.txt` with `confluent-kafka`
2. Restore old `app/kafka_producer.py`
3. Revert `app/routes/events.py` to old version
4. Restart services

But **do not do this** — the new design is simpler and more stable.

---

## SUCCESS CRITERIA

✅ Mobile report reaches Postgres in < 2 seconds  
✅ Duplicate reports return 409 Conflict  
✅ Validation errors return 422 with field details  
✅ Sensor threshold generates alerts  
✅ J2 down → J1 retries with backoff  
✅ Dashboard shows live incidents and alerts  
✅ Offline queue syncs after network restore  
✅ No Kafka in codebase  

---

**Questions?** Check `ARCHITECTURE_REFACTOR_PLAN.md` for detailed design.
