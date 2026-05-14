# Rollout and Testing Guide

**Timeline**: 7 days  
**Team**: 4 people  
**Scope**: Remove Kafka, Replace with HTTP, Deploy and Test

---

## PHASE 1: Local Dev Testing (Day 1)

### Setup

**Terminal 1: Postgres**
```bash
cd disaster-response-system
docker-compose up postgres
# Wait for "database system is ready to accept connections"
```

**Terminal 2: J1 Service**
```bash
cd j1-device-edge/backend
pip install -r requirements.txt
export J2_BASE_URL=http://localhost:8082
export J2_SECRET_TOKEN=dev-secret-token
python -m uvicorn app.main:app --reload --port 8081
```

**Terminal 3: J2 Service**
```bash
cd j2-data-intelligence
pip install -r requirements.txt
export DATABASE_URL=postgresql://user:password@localhost:5432/disaster_db
python -m uvicorn app.main:app --reload --port 8082
```

### Test 1: Basic Health Check

```bash
# J1 Health
curl -s http://localhost:8081/health | jq .

# J2 Health
curl -s http://localhost:8082/api/v1/health | jq .

# Expected: {"status": "ok"}
```

### Test 2: Valid Report Ingestion

```bash
curl -X POST http://localhost:8081/api/v1/ingest/report \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "eventId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-05-12T14:30:00Z",
    "deviceId": "MOBILE_USER_123",
    "disasterType": "FLOOD",
    "district": "Colombo",
    "latitude": 6.9271,
    "longitude": 80.7744,
    "description": "Water overflowing main street in Colombo",
    "contact": "+94701234567",
    "mediaUrls": []
  }'

# Expected Response: 201
# {
#   "success": true,
#   "data": {
#     "eventId": "550e8400-e29b-41d4-a716-446655440000",
#     "status": "ACCEPTED",
#     "id": "uuid-of-report"
#   }
# }
```

### Test 3: Duplicate Report Rejection

```bash
# Same eventId as Test 2
curl -X POST http://localhost:8081/api/v1/ingest/report \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "eventId": "550e8400-e29b-41d4-a716-446655440000",
    ...same as Test 2...
  }'

# Expected Response: 409 Conflict
# {
#   "success": false,
#   "error": "Duplicate report: 550e8400-e29b-41d4-a716-446655440000"
# }
```

### Test 4: Validation Error

```bash
# Missing required 'description' field
curl -X POST http://localhost:8081/api/v1/ingest/report \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440001" \
  -d '{
    "eventId": "550e8400-e29b-41d4-a716-446655440001",
    "timestamp": "2026-05-12T14:30:00Z",
    "deviceId": "MOBILE_USER_456",
    "disasterType": "LANDSLIDE",
    "district": "Kandy",
    "latitude": 7.2906,
    "longitude": 80.6337,
    "description": "short"
  }'

# Expected Response: 422 Unprocessable Entity
# {
#   "success": false,
#   "error": "Validation failed",
#   "errors": [
#     {"field": "description", "reason": "Minimum 10 characters"}
#   ]
# }
```

### Test 5: Sensor Ingestion with Threshold

```bash
curl -X POST http://localhost:8081/api/v1/ingest/sensor \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440002" \
  -d '{
    "eventId": "550e8400-e29b-41d4-a716-446655440002",
    "timestamp": "2026-05-12T14:30:00Z",
    "deviceId": "FLOOD_SENSOR_001",
    "hazardType": "FLOOD",
    "depth": 1.5,
    "temperature": 28.5,
    "humidity": 75.0,
    "division_id": 2
  }'

# Expected Response: 201 Created with alert_triggered=true
# {
#   "success": true,
#   "data": {
#     "eventId": "550e8400-e29b-41d4-a716-446655440002",
#     "deviceId": "FLOOD_SENSOR_001",
#     "status": "ACCEPTED",
#     "alert_triggered": true,
#     "alert": {
#       "type": "FLOOD_THRESHOLD_EXCEEDED",
#       "severity": "HIGH",
#       "message": "Water depth 1.5m exceeds threshold 1.0m at FLOOD_SENSOR_001"
#     }
#   }
# }
```

### Test 6: Verify Database Inserts

```bash
# Connect to Postgres
psql postgresql://user:password@localhost:5432/disaster_db

# Check IncomingReport table
SELECT id, "eventId", source, "disasterType", district FROM public."IncomingReport" LIMIT 5;

# Check iot_rainfall_data table
SELECT row_id, id, type, depth, recorded_at FROM public."iot_rainfall_data" LIMIT 5;

# Check unique constraints
-- Verify eventId is unique
-- Verify (id, recorded_at) is unique on iot_rainfall_data
```

---

## PHASE 2: Database Migrations (Day 2)

### Pre-Migration Backup

```bash
# Backup existing schema
pg_dump -d disaster_db -s > backup_schema_$(date +%Y%m%d).sql
```

### Apply Unique Constraints

```sql
-- 1. Add UNIQUE constraint to IncomingReport
ALTER TABLE public."IncomingReport" ADD UNIQUE ("eventId");

-- 2. Create unique index on iot_rainfall_data
CREATE UNIQUE INDEX iot_rainfall_data_dedup ON public."iot_rainfall_data" (id, recorded_at);

-- 3. Verify constraints exist
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name='IncomingReport';
```

### Verify No Duplicates Exist

```sql
-- Check for duplicate eventIds in IncomingReport
SELECT "eventId", COUNT(*) as count 
FROM public."IncomingReport" 
GROUP BY "eventId" 
HAVING COUNT(*) > 1;

-- Should return 0 rows

-- Check for duplicate (id, recorded_at) in iot_rainfall_data
SELECT id, recorded_at, COUNT(*) as count 
FROM public."iot_rainfall_data" 
GROUP BY id, recorded_at 
HAVING COUNT(*) > 1;

-- Should return 0 rows
```

---

## PHASE 3: Service Integration Testing (Day 3)

### Test 1: End-to-End Report Flow

**Scenario**: Mobile app sends report → J1 validates → J2 inserts → Dashboard shows

```bash
# 1. Send report to J1
REPORT_ID=$(curl -s -X POST http://localhost:8081/api/v1/ingest/report \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: e2e-report-001" \
  -d '{
    "eventId": "e2e-report-001",
    "timestamp": "2026-05-12T15:00:00Z",
    "deviceId": "MOBILE_TEST_001",
    "disasterType": "FLOOD",
    "district": "Colombo",
    "latitude": 6.9271,
    "longitude": 80.7744,
    "description": "Major flooding in downtown Colombo area",
    "contact": "+94701234567",
    "mediaUrls": []
  }' | jq -r '.data.id')

echo "Report ID: $REPORT_ID"

# 2. Verify in J2
curl -s http://localhost:8082/api/v1/incidents?district=Colombo | jq .

# 3. Verify in Postgres
psql postgresql://user:password@localhost:5432/disaster_db -c \
  "SELECT id, \"eventId\", district FROM public.\"IncomingReport\" WHERE \"eventId\"='e2e-report-001';"
```

### Test 2: Sensor Ingestion with Multiple Readings

**Scenario**: IoT sensor sends 3 readings (1 below threshold, 2 above)

```bash
# Reading 1: Normal
curl -s -X POST http://localhost:8081/api/v1/ingest/sensor \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: sensor-001" \
  -d '{
    "eventId": "sensor-001",
    "timestamp": "2026-05-12T15:00:00Z",
    "deviceId": "FLOOD_SENSOR_001",
    "hazardType": "FLOOD",
    "depth": 0.5
  }' | jq '.data.alert_triggered'
# Expected: false

# Reading 2: Threshold exceeded
curl -s -X POST http://localhost:8081/api/v1/ingest/sensor \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: sensor-002" \
  -d '{
    "eventId": "sensor-002",
    "timestamp": "2026-05-12T15:05:00Z",
    "deviceId": "FLOOD_SENSOR_001",
    "hazardType": "FLOOD",
    "depth": 1.2
  }' | jq '.data.alert_triggered'
# Expected: true

# Reading 3: Critical level
curl -s -X POST http://localhost:8081/api/v1/ingest/sensor \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: sensor-003" \
  -d '{
    "eventId": "sensor-003",
    "timestamp": "2026-05-12T15:10:00Z",
    "deviceId": "FLOOD_SENSOR_001",
    "hazardType": "FLOOD",
    "depth": 1.8
  }' | jq '.data.alert_triggered'
# Expected: true (severity: HIGH)
```

### Test 3: J1 Retry on J2 Timeout

**Scenario**: J2 service becomes unavailable → J1 retries → returns 503

```bash
# 1. Stop J2 service
# (Ctrl+C in Terminal 3)

# 2. Send report to J1 (should retry and fail after 3 attempts)
curl -v -X POST http://localhost:8081/api/v1/ingest/report \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: retry-test-001" \
  -d '{
    "eventId": "retry-test-001",
    "timestamp": "2026-05-12T15:30:00Z",
    "deviceId": "MOBILE_TEST_002",
    "disasterType": "FLOOD",
    "district": "Colombo",
    "latitude": 6.9271,
    "longitude": 80.7744,
    "description": "Testing J2 unavailability retry logic"
  }'

# Expected: 503 Service Unavailable
# Check J1 logs: should see retry attempts with backoff

# 3. Restart J2 and resend
# (In Terminal 3: uvicorn app.main:app --reload --port 8082)

# 4. Resend same eventId (should now work)
# Should succeed because mobile would retry from offline queue
```

### Test 4: Concurrent Requests (Load Test Light)

**Scenario**: Send 10 simultaneous reports

```bash
# Create test script
cat > test_concurrent.sh << 'EOF'
#!/bin/bash
for i in {1..10}; do
  EVENT_ID="concurrent-$(uuidgen)"
  curl -X POST http://localhost:8081/api/v1/ingest/report \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $EVENT_ID" \
    -d "{
      \"eventId\": \"$EVENT_ID\",
      \"timestamp\": \"2026-05-12T15:45:00Z\",
      \"deviceId\": \"MOBILE_CONCURRENT_$i\",
      \"disasterType\": \"FLOOD\",
      \"district\": \"Colombo\",
      \"latitude\": 6.9271,
      \"longitude\": 80.7744,
      \"description\": \"Concurrent test report number $i\"
    }" &
done
wait
EOF

chmod +x test_concurrent.sh
./test_concurrent.sh

# Check results
curl -s http://localhost:8082/api/v1/incidents?district=Colombo | jq '.data | length'
# Should see all 10 reports
```

---

## PHASE 4: Performance Testing (Day 4)

### Latency Measurement

```bash
# J1 Ingestion Latency (report only, no J2 wait)
time curl -s -X POST http://localhost:8081/api/v1/ingest/report \
  -H "Content-Type: application/json" \
  -d '{...}' > /dev/null

# Expected: < 100ms (should be fast, J1 returns 202/201 quickly)
```

### Database Write Latency

```bash
# In Postgres
SELECT AVG(EXTRACT(EPOCH FROM (created_at - created_at))) * 1000 as avg_ms_to_insert
FROM public."IncomingReport"
WHERE created_at > NOW() - INTERVAL '1 hour';

# Expected: < 10ms per write
```

### Error Rate Under Load

```bash
# Use Apache Bench or similar
ab -n 1000 -c 10 \
  -p request.json \
  -T "application/json" \
  -H "Idempotency-Key: bench-test" \
  http://localhost:8081/api/v1/ingest/report

# Monitor:
# - 201 (success) count
# - 409 (duplicate) count
# - 422 (validation) count
# - 503 (service error) count
# - Failed requests: should be 0
```

---

## PHASE 5: Staging Deployment (Day 5-6)

### Pre-Deployment Checklist

```bash
# 1. Verify all new files exist
ls j1-device-edge/backend/app/j2_client.py
ls j1-device-edge/backend/app/validation.py
ls j2-data-intelligence/app/api/ingest.py

# 2. Verify no Kafka imports remain
grep -r "kafka" j1-device-edge/backend/app/
grep -r "from confluent_kafka" j1-device-edge/backend/requirements.txt
# Should return: no results

# 3. Verify requirements.txt
cat j1-device-edge/backend/requirements.txt
# Should contain: httpx, NOT confluent-kafka
```

### Docker Build

```bash
# Build J1 image
cd j1-device-edge/backend
docker build -t disaster-j1:v2 .

# Build J2 image
cd ../../j2-data-intelligence
docker build -t disaster-j2:v2 .

# Verify images
docker images | grep disaster
```

### Staging Deployment

```bash
# Update docker-compose for staging
cat > docker-compose.staging.yml << 'EOF'
version: '3.9'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: staging-password
      POSTGRES_DB: disaster_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  j1:
    image: disaster-j1:v2
    environment:
      J2_BASE_URL: http://j2:8082
      J2_SECRET_TOKEN: staging-secret
      CORS_ORIGINS: "*"
    ports:
      - "8081:8000"
    depends_on:
      - j2

  j2:
    image: disaster-j2:v2
    environment:
      DATABASE_URL: postgresql://postgres:staging-password@postgres:5432/disaster_db
    ports:
      - "8082:8000"
    depends_on:
      - postgres

volumes:
  postgres_data:
EOF

# Deploy
docker-compose -f docker-compose.staging.yml up -d

# Verify
curl http://localhost:8081/health
curl http://localhost:8082/api/v1/health
```

---

## PHASE 6: Demo & Incident Scenario (Day 6)

### Full Incident Scenario

**Goal**: Demonstrate complete workflow: Report → Verification → Incident → Alert → Dispatch

```bash
# Step 1: Mobile user reports flooding (10:00 AM)
curl -X POST http://localhost:8081/api/v1/ingest/report \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-incident-001" \
  -d '{
    "eventId": "demo-incident-001",
    "timestamp": "2026-05-12T10:00:00Z",
    "deviceId": "MOBILE_DEMO_001",
    "disasterType": "FLOOD",
    "district": "Colombo",
    "latitude": 6.9271,
    "longitude": 80.7744,
    "description": "Major flooding reported in Colombo city center. Multiple vehicles stranded.",
    "contact": "+94701234567",
    "mediaUrls": ["https://demo-bucket.s3/report-001/flood.jpg"]
  }'
# Response: 201 Created with report ID

# Step 2: IoT sensors confirm (10:05 AM)
curl -X POST http://localhost:8081/api/v1/ingest/sensor \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-sensor-001" \
  -d '{
    "eventId": "demo-sensor-001",
    "timestamp": "2026-05-12T10:05:00Z",
    "deviceId": "FLOOD_SENSOR_COLOMBO_01",
    "hazardType": "FLOOD",
    "depth": 1.8,
    "temperature": 29.0,
    "humidity": 85.0,
    "division_id": 1,
    "latitude": 6.9271,
    "longitude": 80.7744
  }'
# Response: 201 Created with alert_triggered=true

# Step 3: Dashboard shows incident
curl -s http://localhost:8082/api/v1/incidents?status=ACTIVE | jq '.data[0]'

# Step 4: Dashboard shows alerts
curl -s http://localhost:8082/api/v1/alerts?district=Colombo | jq '.data[]'

# Demo Talking Points:
# - Fast ingestion (<2 sec end-to-end)
# - Automatic alert generation
# - No Kafka complexity
# - Database-level idempotency (safe retries)
# - Mobile offline support (via SQLite queue)
```

---

## PHASE 7: Go-Live (Day 7)

### Production Deployment

1. **Database**: Apply migrations to production Postgres
2. **Deploy J2 first** (must be ready before J1 starts forwarding)
3. **Deploy J1** (will begin forwarding immediately)
4. **Monitoring**: Check logs for errors, ingestion rate, alerts

### Rollback Plan

If critical issue found:
```bash
# 1. Stop J1 (stop forwarding to J2)
kubectl scale deployment j1 --replicas=0

# 2. Revert J2 to stable version
kubectl set image deployment/j2 \
  j2=disaster-j2:v1 --record

# 3. Restore Kafka if absolutely necessary
# (but avoid — should not be needed)
```

---

## SUCCESS CRITERIA (GO/NO-GO)

✅ **MUST HAVE:**
- [x] Mobile → J1 → J2 → Postgres end-to-end works
- [x] Duplicate reports return 409
- [x] Validation errors return 422 with field details
- [x] Sensor threshold generates alerts
- [x] Offline queue syncs successfully
- [x] No Kafka in production code

⚠️ **NICE TO HAVE:**
- [ ] < 200ms end-to-end latency
- [ ] < 1% error rate under 100 RPS
- [ ] Dashboard shows live incidents/alerts

❌ **BLOCKERS:**
- [ ] Unique constraint violations (means duplicates in old data)
- [ ] J1-J2 connection fails (config error)
- [ ] Database migration fails (backup and retry)

---

## Contact & Escalation

- **Backend Lead**: J1/J2 issues
- **DevOps Lead**: Deployment/monitoring issues
- **QA Lead**: Test case failures
- **Product**: Go/no-go decision

---

**Remember:** Keep it simple. Test thoroughly. Deploy confidently.
