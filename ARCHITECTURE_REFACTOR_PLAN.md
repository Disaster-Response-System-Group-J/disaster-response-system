# Disaster Response Platform - Simplified Architecture Refactor

## 1. FINAL SIMPLIFIED ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│ MOBILE APP (Flutter)                                         │
├─────────────────────────────────────────────────────────────┤
│ • Offline SQLite (queue only)                               │
│ • Auth token from KeyCloak                                  │
│ • SOS Reports + IoT telemetry                               │
│ • Sends 2 event types: REPORT_INGEST, SENSOR_INGEST        │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ J1 SERVICE (Auth + Gateway)                                 │
├─────────────────────────────────────────────────────────────┤
│ • Authenticate mobile user (Bearer token → J1 user)        │
│ • Validate payload schema (required fields)                 │
│ • Normalize fields (aliases, enums)                         │
│ • Upload media to S3/bucket                                 │
│ • Generate idempotency key (eventId)                        │
│ • Forward to J2 (HTTP POST)                                │
│ • Retry on transient failures (503, timeouts)              │
│ • Cache J2 health status                                    │
│ NO: complex API gateway, routing rules, caching logic      │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS (internal)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ J2 SERVICE (Core Logic)                                     │
├─────────────────────────────────────────────────────────────┤
│ • Receive normalized ingest from J1                        │
│ • Write to Postgres (idempotent)                           │
│ • Process sensor data → thresholds → alerts                │
│ • Generate risk events (from predictions or sensors)       │
│ • Expose read APIs (incidents, resources, alerts)          │
│ • NO: Kafka, Celery, async ML, distributed processing     │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQL
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ POSTGRES DATABASE                                           │
├─────────────────────────────────────────────────────────────┤
│ • Single canonical REPORT table (IncomingReport)           │
│ • Single canonical SENSOR table (iot_rainfall_data)        │
│ • Risk events table (risk_alert_events)                    │
│ • Incidents table (ConfirmedIncident)                      │
│ • Unique constraints for idempotency                       │
│ • Enums for type safety                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. SERVICE RESPONSIBILITY BREAKDOWN

### Mobile App
**Owns:**
- User authentication (OAuth2 with KeyCloak)
- Offline SQLite: queue + retry buffer only
- Form validation on client (UX only)
- Media capture (camera, files)
- Idempotency key generation (UUID v4)
- Bearer token refresh

**Does NOT own:**
- Server-side validation
- Risk analysis
- Incident confirmation
- Resource allocation

**Sends to J1:**
```json
{
  "eventType": "REPORT_INGEST" | "SENSOR_INGEST",
  "eventId": "uuid-v4",
  "timestamp": "ISO 8601",
  "payload": {
    // report or sensor data
  }
}
```

### J1 Service (Auth + Normalization Gateway)
**Owns:**
- Mobile user authentication (OAuth2 token → J1 user)
- Payload schema validation
- Field normalization (aliases, enums)
- Media upload (S3/bucket with event ID)
- Idempotency tracking (per-eventId)
- Retry logic (exponential backoff to J2)
- Health check polling for J2

**Does NOT own:**
- Business logic
- Database writes
- Risk scoring
- Incident creation
- Incident confirmation
- Alert generation

**FLOW:**
1. Receive event from mobile (eventId, payload)
2. Verify Idempotency-Key header matches eventId
3. Check idempotency store (memory + optional Redis)
4. Validate required fields (deviceId, type, timestamp, etc.)
5. Normalize enum values
6. Upload media (if present)
7. HTTP POST to J2 `/api/v1/ingest/{type}` with Authorization header
8. Retry on 503, timeout
9. Return 202 Accepted (async confirmation)

### J2 Service (Core Data + Logic)
**Owns:**
- Database writes (idempotent)
- Sensor data processing (threshold alerts)
- Risk event generation (from predictions or sensors)
- Read APIs (incidents, resources, alerts)
- Feature engineering (simple, local)
- Lightweight predictions (no ML orchestration)

**Does NOT own:**
- Mobile authentication
- Media upload
- Payload validation (trust J1)
- Kafka/queuing
- Complex ML pipelines

**FLOW:**
1. Receive ingest from J1
2. Verify J1 authorization token
3. Attempt to write (INSERT IGNORE or UPSERT)
4. If duplicate → log + return 409
5. If success → process (sensor thresholds, alerts)
6. Return 201 Created with resource ID

### Postgres Database
**Owns:**
- Single source of truth for all data
- Unique constraints for idempotency
- Referential integrity
- Event audit trail (risk_alert_events)

**Schema Simplifications:**
- Remove: `Report` table (use `IncomingReport` only)
- Keep: `IncomingReport` as canonical report table
- Keep: `iot_rainfall_data` as canonical sensor table
- Add: unique constraint on `(eventId)` for deduplication
- Add: unique constraint on `(deviceId, timestamp, hazardType)` for sensors

---

## 3. FINAL CANONICAL SCHEMAS

### Schema 1: ReportIngest (from Mobile → J1 → J2 → DB)

**Request (Mobile → J1):**
```json
{
  "eventType": "REPORT_INGEST",
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-05-12T14:30:00Z",
  "payload": {
    "deviceId": "MOBILE_USER_123",
    "disasterType": "FLOOD",
    "district": "Colombo",
    "latitude": 6.9271,
    "longitude": 80.7744,
    "description": "Water overflowing main street",
    "contact": "+94701234567",
    "mediaUrls": [
      "s3://bucket/550e8400-e29b-41d4-a716-446655440000/photo.jpg"
    ]
  }
}
```

**Normalized (J1 → J2):**
```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "source": "MOBILE_APP",
  "disasterType": "FLOOD",
  "district": "Colombo",
  "latitude": 6.9271,
  "longitude": 80.7744,
  "description": "Water overflowing main street",
  "contact": "+94701234567",
  "mediaUrls": [
    "s3://bucket/550e8400-e29b-41d4-a716-446655440000/photo.jpg"
  ],
  "verificationStatus": "PENDING_REVIEW",
  "deviceId": "MOBILE_USER_123",
  "createdAt": "2026-05-12T14:30:00Z"
}
```

**DB Table (IncomingReport):**
```sql
id uuid PRIMARY KEY (gen_random_uuid)
eventId varchar UNIQUE NOT NULL  -- Idempotency key
source enum NOT NULL              -- MOBILE_APP, IOT_SENSOR, OFFICER_ENTRY
disasterType enum NOT NULL        -- FLOOD, LANDSLIDE, DROUGHT
district varchar NOT NULL
latitude numeric NOT NULL
longitude numeric NOT NULL
description text NOT NULL
contact varchar
mediaUrls text[] 
verificationStatus enum DEFAULT 'PENDING_REVIEW'
deviceId varchar
createdAt timestamp DEFAULT now()
reviewedAt timestamp
reviewedById uuid FOREIGN KEY
incidentId uuid FOREIGN KEY
```

**Validation Rules (J1):**
- `deviceId` → REQUIRED
- `disasterType` → REQUIRED, must be enum (FLOOD | LANDSLIDE | DROUGHT)
- `district` → REQUIRED
- `latitude`, `longitude` → REQUIRED, numeric, valid range
- `description` → REQUIRED, min 10 chars
- `timestamp` → REQUIRED, ISO 8601
- `mediaUrls` → OPTIONAL, max 5, must be HTTPS URLs

**Status Codes:**
- `201 Created` → Inserted into DB
- `409 Conflict` → Duplicate (eventId already exists)
- `422 Unprocessable Entity` → Validation error (return field + reason)
- `503 Service Unavailable` → J2 is down (mobile retries)

---

### Schema 2: SensorIngest (from IoT → J1 → J2 → DB)

**Request (Mobile/IoT → J1):**
```json
{
  "eventType": "SENSOR_INGEST",
  "eventId": "550e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2026-05-12T14:30:00Z",
  "payload": {
    "deviceId": "FLOOD_SENSOR_001",
    "hazardType": "FLOOD",
    "depth": 1.25,
    "temperature": 28.5,
    "humidity": 75.3,
    "division_id": 2,
    "latitude": 6.9271,
    "longitude": 80.7744
  }
}
```

**Normalized (J1 → J2):**
```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440001",
  "deviceId": "FLOOD_SENSOR_001",
  "type": "FLOOD",
  "depth": 1.25,
  "temp": 28.5,
  "hum": 75.3,
  "division_id": 2,
  "latitude": 6.9271,
  "longitude": 80.7744,
  "recorded_at": "2026-05-12T14:30:00Z"
}
```

**DB Table (iot_rainfall_data):**
```sql
row_id integer PRIMARY KEY AUTO_INCREMENT
id varchar NOT NULL                    -- eventId (for dedup)
type enum NOT NULL                     -- FLOOD
temp numeric
hum numeric
depth numeric
recorded_at timestamp UNIQUE NOT NULL  -- (id, recorded_at) composite unique
```

**Validation Rules (J1):**
- `deviceId` → REQUIRED
- `hazardType` → REQUIRED, must be enum (FLOOD | LANDSLIDE | DROUGHT)
- `timestamp` → REQUIRED, ISO 8601
- At least ONE sensor field (depth, temp, hum, moisture)
- `latitude`, `longitude` → OPTIONAL but recommended

**Unique Constraint (DB):**
```sql
UNIQUE(id, recorded_at)
```
(Prevents exact duplicate sensor readings)

**Status Codes:**
- `201 Created` → Inserted
- `409 Conflict` → Duplicate (same deviceId + timestamp + type)
- `422 Unprocessable Entity` → Validation error
- `503 Service Unavailable` → J2 is down

---

## 4. DATABASE DESIGN RECOMMENDATIONS

### Table Resolution: IncomingReport vs Report

**Decision: Keep IncomingReport ONLY**

Why:
- `IncomingReport` has event tracking (eventId, verificationStatus, audit trail)
- `Report` is legacy (sequential ID, no deduplication)
- IncomingReport maps directly to mobile ingestion

**Action:**
- DELETE `Report` table
- Update all references to use `IncomingReport`
- Add UNIQUE constraint on `eventId` for deduplication

### Sensor Data Table

**Keep iot_rainfall_data (exists, adequate)**

```sql
CREATE UNIQUE INDEX iot_rainfall_data_dedup ON iot_rainfall_data (id, recorded_at);
```

### Key Unique Constraints

```sql
-- IncomingReport: Prevent duplicate reports from same event
ALTER TABLE IncomingReport ADD UNIQUE (eventId);

-- iot_rainfall_data: Prevent duplicate sensor readings
CREATE UNIQUE INDEX iot_rainfall_data_dedup ON iot_rainfall_data (id, recorded_at);

-- Risk events: Prevent duplicate alerts from same prediction
ALTER TABLE risk_alert_events ADD UNIQUE (event_id);
```

### Enum Consistency

**Disaster Types (use across all tables):**
```sql
-- disasterType in IncomingReport
-- type in iot_rainfall_data
-- hazard_type in risk_alert_events
-- disasterType in ConfirmedIncident

Enum values: FLOOD | LANDSLIDE | DROUGHT
```

**Verification Status:**
```sql
PENDING_REVIEW | VERIFIED | DISMISSED | ESCALATED
```

**Incident Status:**
```sql
ACTIVE | RESOLVED | CANCELED
```

### Nullable Field Guidance

| Field | Table | Nullable | Notes |
|-------|-------|----------|-------|
| eventId | IncomingReport | NO | PK for dedup |
| mediaUrls | IncomingReport | YES | Optional attachments |
| contact | IncomingReport | YES | Reporter may be anonymous |
| reviewedAt | IncomingReport | YES | Only if verified |
| reviewedById | IncomingReport | YES | Only if reviewed |
| incidentId | IncomingReport | YES | Null until linked |
| latitude | iot_rainfall_data | YES | May lack GPS |
| longitude | iot_rainfall_data | YES | May lack GPS |

---

## 5. FINAL API DESIGN

### J1 Service (Ingestion Gateway)

#### Endpoint 1: POST /api/v1/ingest/report
Ingest a report from mobile app.

**Request:**
```http
POST /api/v1/ingest/report HTTP/1.1
Authorization: Bearer <j1-token>
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-05-12T14:30:00Z",
  "deviceId": "MOBILE_USER_123",
  "disasterType": "FLOOD",
  "district": "Colombo",
  "latitude": 6.9271,
  "longitude": 80.7744,
  "description": "Water overflowing main street",
  "contact": "+94701234567",
  "mediaUrls": ["s3://bucket/550e8400-e29b-41d4-a716-446655440000/photo.jpg"]
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "eventId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "ACCEPTED",
    "id": "uuid-of-incoming-report"
  }
}
```

**Conflict Response (409):**
```json
{
  "success": false,
  "error": "Duplicate event: 550e8400-e29b-41d4-a716-446655440000"
}
```

**Validation Error Response (422):**
```json
{
  "success": false,
  "error": "Validation failed",
  "errors": [
    {
      "field": "description",
      "reason": "Must be at least 10 characters"
    }
  ]
}
```

**Timeout (503):**
```json
{
  "success": false,
  "error": "J2 service unavailable. Retry in 5 seconds."
}
```

---

#### Endpoint 2: POST /api/v1/ingest/sensor
Ingest sensor readings from IoT device.

**Request:**
```http
POST /api/v1/ingest/sensor HTTP/1.1
Authorization: Bearer <j1-token>
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440001

{
  "eventId": "550e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2026-05-12T14:30:00Z",
  "deviceId": "FLOOD_SENSOR_001",
  "hazardType": "FLOOD",
  "depth": 1.25,
  "temperature": 28.5,
  "humidity": 75.3,
  "division_id": 2
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "eventId": "550e8400-e29b-41d4-a716-446655440001",
    "sensorId": "FLOOD_SENSOR_001",
    "status": "ACCEPTED"
  }
}
```

---

### J2 Service (Core API)

#### Endpoint 1: POST /api/v1/ingest/report
(Called by J1, NOT directly by mobile)

**Request:**
```http
POST /api/v1/ingest/report HTTP/1.1
Authorization: Bearer <j1-j2-token>
Content-Type: application/json

{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "source": "MOBILE_APP",
  "disasterType": "FLOOD",
  "district": "Colombo",
  "latitude": 6.9271,
  "longitude": 80.7744,
  "description": "Water overflowing main street",
  "contact": "+94701234567",
  "mediaUrls": ["s3://bucket/.../photo.jpg"],
  "deviceId": "MOBILE_USER_123"
}
```

**Success (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-of-report",
    "eventId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "PENDING_REVIEW"
  }
}
```

**Duplicate (409):**
```json
{
  "success": false,
  "error": "Report with eventId already exists"
}
```

---

#### Endpoint 2: POST /api/v1/ingest/sensor
(Called by J1)

**Request:**
```http
POST /api/v1/ingest/sensor HTTP/1.1
Authorization: Bearer <j1-j2-token>

{
  "eventId": "550e8400-e29b-41d4-a716-446655440001",
  "deviceId": "FLOOD_SENSOR_001",
  "type": "FLOOD",
  "depth": 1.25,
  "temp": 28.5,
  "hum": 75.3,
  "recorded_at": "2026-05-12T14:30:00Z"
}
```

**Success (201):**
```json
{
  "success": true,
  "data": {
    "row_id": 12345,
    "deviceId": "FLOOD_SENSOR_001",
    "alert_triggered": false
  }
}
```

If sensor depth > threshold:
```json
{
  "success": true,
  "data": {
    "row_id": 12345,
    "deviceId": "FLOOD_SENSOR_001",
    "alert_triggered": true,
    "alert": {
      "id": "alert-uuid",
      "type": "FLOOD_THRESHOLD_EXCEEDED",
      "severity": "HIGH",
      "message": "Water level 1.25m exceeds threshold 1.0m at FLOOD_SENSOR_001"
    }
  }
}
```

---

#### Endpoint 3: GET /api/v1/incidents
List all confirmed incidents (for dashboard).

**Request:**
```http
GET /api/v1/incidents?district=Colombo&status=ACTIVE HTTP/1.1
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "incident-uuid",
      "title": "Colombo Flooding",
      "disasterType": "FLOOD",
      "district": "Colombo",
      "severity": "HIGH",
      "status": "ACTIVE",
      "latitude": 6.9271,
      "longitude": 80.7744,
      "createdAt": "2026-05-12T14:30:00Z",
      "affectedPeople": 5000
    }
  ]
}
```

---

#### Endpoint 4: GET /api/v1/alerts
List active alerts.

**Request:**
```http
GET /api/v1/alerts?district=Colombo HTTP/1.1
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "alert-uuid",
      "type": "FLOOD_THRESHOLD_EXCEEDED",
      "severity": "HIGH",
      "title": "Water Level Critical",
      "description": "FLOOD_SENSOR_001 depth 1.25m",
      "district": "Colombo",
      "isActive": true,
      "createdAt": "2026-05-12T14:30:00Z"
    }
  ]
}
```

---

## 6. CLEAN ROLLOUT PLAN

### Phase 1: J1 Refactor (Day 1-2)
- [ ] Remove Kafka dependencies from J1
- [ ] Add J2 HTTP client (with retry + backoff)
- [ ] Update models to match ReportIngest / SensorIngest schemas
- [ ] Add field validation (required, enum, range checks)
- [ ] Add media upload logic (if not present)
- [ ] Deploy J1 with feature flag: `USE_J2_HTTP=true`

### Phase 2: J2 Preparation (Day 2-3)
- [ ] Add POST `/api/v1/ingest/report` endpoint
- [ ] Add POST `/api/v1/ingest/sensor` endpoint
- [ ] Implement idempotent writes (UPSERT or INSERT IGNORE)
- [ ] Add unique constraint on `IncomingReport.eventId`
- [ ] Add unique constraint on `iot_rainfall_data (id, recorded_at)`
- [ ] Add J1 authorization header validation
- [ ] Remove Kafka consumer from J2 (keep services)

### Phase 3: Schema Cleanup (Day 3-4)
- [ ] Verify `Report` table is unused (grep codebase)
- [ ] Archive/drop `Report` table
- [ ] Verify all references use `IncomingReport`
- [ ] Add enum consistency checks (disasterType)
- [ ] Test deduplication (insert same eventId twice)

### Phase 4: Integration Testing (Day 4-5)
- [ ] Mobile → J1 → J2 → Postgres end-to-end
- [ ] Test idempotency (retry report, expect 409)
- [ ] Test sensor threshold alerts
- [ ] Test offline queue in mobile SQLite
- [ ] Test J1 retry logic (503 handling)

### Phase 5: Monitoring & Docs (Day 5-6)
- [ ] Add request/response logging (J1 ↔ J2)
- [ ] Add alert for J2 down (J1 → 503)
- [ ] Add dashboard: ingestion rate, error rate
- [ ] Document API for mobile team
- [ ] Document deployment steps

### Phase 6: Staging & Demo (Day 6-7)
- [ ] Deploy to staging
- [ ] Run full incident scenario (report → incident → alert)
- [ ] Demo to stakeholders
- [ ] Fix edge cases (incomplete payloads, etc.)
- [ ] Go-live checklist

---

## 7. HIGH-RISK AREAS & MITIGATION

### Risk 1: Schema Drift (IncomingReport vs Report)

**Problem:** Team isn't sure which table to use.

**Mitigation:**
- [ ] Drop `Report` immediately (day 3)
- [ ] Add migration: `ALTER TABLE IncomingReport ADD UNIQUE (eventId)`
- [ ] Add comment on `IncomingReport`: "DO NOT duplicate. This is the canonical report table."

---

### Risk 2: mediaUrls Handling

**Problem:** URLs can be null, empty array, or wrong format.

**Mitigation:**
- [ ] J1 validates: `if mediaUrls: all must be HTTPS URLs`
- [ ] J1 stores: S3 URLs with event ID in path (e.g., `s3://bucket/{eventId}/{filename}`)
- [ ] J2 stores as-is (trust J1)
- [ ] Mobile: offline queue includes media file refs (not full URLs)

---

### Risk 3: Incomplete Mobile Payloads

**Problem:** Mobile sends partial data (no description, bad coords).

**Mitigation:**
- [ ] J1 validates before forwarding to J2
- [ ] Return 422 with field-level errors: `{"field": "description", "reason": "Required"}`
- [ ] Mobile retries with user intervention
- [ ] Don't log user data to avoid PII leaks

---

### Risk 4: Offline Sync Conflicts

**Problem:** Mobile queues report offline, then network returns → duplicate submission + retry.

**Mitigation:**
- [ ] Mobile generates eventId on device (UUID v4) before offline queue
- [ ] Offline queue stores (eventId, payload, timestamp)
- [ ] On sync: check J1 response (201 / 409 / 422 / 503)
- [ ] If 409: skip (already submitted), mark complete
- [ ] If 422: remove from queue (bad data), notify user
- [ ] If 503: keep in queue, retry in 30 seconds (exponential backoff)

---

### Risk 5: J1 ↔ J2 Integration Failure

**Problem:** J1 forward to J2 fails mid-way (network timeout, J2 crash).

**Mitigation:**
- [ ] J1 uses timeout: **5 seconds** for J2 POST
- [ ] Retry logic: exponential backoff (1s, 2s, 4s, 8s) → max 3 retries
- [ ] After 3 retries → log + return 503 to mobile
- [ ] Mobile retries from offline queue
- [ ] J2 idempotent writes (unique constraint) → no duplicates even if retried

---

### Risk 6: Sensor Threshold Processing

**Problem:** How to avoid generating duplicate alerts for same sensor reading?

**Mitigation:**
- [ ] Unique constraint on `iot_rainfall_data (deviceId, recorded_at, type)`
- [ ] When alert triggered: store alert ID in risk_alert_events with unique event_id
- [ ] Check: `if depth > threshold && !alert_exists(deviceId, depth, timestamp)` → create alert

---

## 8. IMPLEMENTATION CHECKLIST

### J1 Changes
- [ ] Remove `kafka_producer.py`
- [ ] Remove Kafka from `requirements.txt`
- [ ] Add `httpx` or `aiohttp` to `requirements.txt`
- [ ] Create `app/j2_client.py` (HTTP client to J2 with retry)
- [ ] Update `app/routes/events.py` → POST `/api/v1/ingest/{report|sensor}`
- [ ] Update `app/models.py` → ReportIngest / SensorIngest schemas
- [ ] Add `app/validation.py` → field validation logic
- [ ] Add `app/media_upload.py` → S3/bucket upload
- [ ] Update `.env` → J2_BASE_URL, J2_SECRET_TOKEN

### J2 Changes
- [ ] Add `POST /api/v1/ingest/report` → inserts to IncomingReport
- [ ] Add `POST /api/v1/ingest/sensor` → inserts to iot_rainfall_data
- [ ] Add idempotent write logic (INSERT IGNORE or UPSERT)
- [ ] Add sensor threshold check (depth > 1.0 → create Alert)
- [ ] Add J1 authorization middleware
- [ ] Remove Kafka consumer

### Database Changes
- [ ] Add UNIQUE constraint on `IncomingReport.eventId`
- [ ] Add UNIQUE constraint on `iot_rainfall_data (id, recorded_at)`
- [ ] Verify enum consistency (disasterType)
- [ ] Backup before dropping `Report` table

### Mobile Changes
- [ ] Generate eventId on device (UUID v4)
- [ ] Store eventId + payload in offline SQLite queue
- [ ] Add retry logic (exponential backoff)
- [ ] Parse J1 response codes (201 / 409 / 422 / 503)
- [ ] Handle offline gracefully

---

## 9. DEPLOYMENT

### Local Dev
```bash
# Terminal 1: Postgres
docker-compose up postgres

# Terminal 2: J1
cd j1-device-edge/backend
export J2_BASE_URL=http://localhost:8082
export J2_SECRET_TOKEN=dev-token
python -m uvicorn app.main:app --reload --port 8081

# Terminal 3: J2
cd j2-data-intelligence
export DATABASE_URL=postgresql://...
python -m uvicorn app.main:app --reload --port 8082
```

### Staging/Production
```bash
docker-compose build
docker-compose push
kubectl apply -f k8s/
```

---

## 10. EXPECTED TIMELINE

| Phase | Task | Days | Owner |
|-------|------|------|-------|
| 1 | J1 Refactor | 2 | Backend Dev 1 |
| 2 | J2 Endpoints | 2 | Backend Dev 2 |
| 3 | Schema Cleanup | 1 | DBA / Backend Dev 2 |
| 4 | Integration Testing | 2 | QA / Backend Devs |
| 5 | Monitoring | 1 | DevOps / Backend Dev 1 |
| 6 | Staging & Demo | 2 | Team |
| **Total** | | **~7 days** | |

---

## 11. SUCCESS CRITERIA

✅ Mobile report → J1 → J2 → Postgres (end-to-end)  
✅ Duplicate reports rejected (409)  
✅ Sensor threshold → alert generated  
✅ Offline queue syncs after network restore  
✅ J1 retries J2 on 503  
✅ Dashboard shows ingestion rate, error rate  
✅ Incident demo works (report → confirm → alert)  
✅ No Kafka dependencies in codebase  
✅ Deployment runs in < 5 minutes  

---

**Author**: Architecture Review  
**Last Updated**: 2026-05-12  
**Status**: Ready for Implementation
