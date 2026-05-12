# Quick Reference Card

**For**: Developers implementing J1-J2 HTTP integration  
**Use**: Copy-paste, test locally, deploy with confidence  

---

## SETUP (10 minutes)

### J1 Local Dev

```bash
cd j1-device-edge/backend
pip install -r requirements.txt
export J2_BASE_URL=http://localhost:8082
export J2_SECRET_TOKEN=dev-secret-token
python -m uvicorn app.main:app --reload --port 8081
```

### J2 Local Dev

```bash
cd j2-data-intelligence
pip install -r requirements.txt
export DATABASE_URL=postgresql://user:pass@localhost:5432/db
python -m uvicorn app.main:app --reload --port 8082
```

### Database Migrations

```sql
ALTER TABLE public."IncomingReport" ADD UNIQUE ("eventId");
CREATE UNIQUE INDEX iot_rainfall_data_dedup 
ON public."iot_rainfall_data" (id, recorded_at);
```

---

## COMMON TESTS

### Test 1: Valid Report (should return 201)

```bash
curl -X POST http://localhost:8081/api/v1/ingest/report \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-001" \
  -d '{
    "eventId": "test-001",
    "timestamp": "2026-05-12T14:30:00Z",
    "deviceId": "MOBILE_001",
    "disasterType": "FLOOD",
    "district": "Colombo",
    "latitude": 6.9271,
    "longitude": 80.7744,
    "description": "Water overflowing main street"
  }'
```

### Test 2: Duplicate Report (should return 409)

```bash
# Same eventId as Test 1
curl -X POST http://localhost:8081/api/v1/ingest/report \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-001" \
  -d '{...same as Test 1...}'
```

### Test 3: Invalid Field (should return 422)

```bash
curl -X POST http://localhost:8081/api/v1/ingest/report \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-invalid" \
  -d '{
    "eventId": "test-invalid",
    "timestamp": "2026-05-12T14:30:00Z",
    "deviceId": "MOBILE_002",
    "disasterType": "FLOOD",
    "district": "Colombo",
    "latitude": 6.9271,
    "longitude": 80.7744,
    "description": "short"  # TOO SHORT (min 10 chars)
  }'
```

### Test 4: Sensor with Threshold (should return alert)

```bash
curl -X POST http://localhost:8081/api/v1/ingest/sensor \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: sensor-001" \
  -d '{
    "eventId": "sensor-001",
    "timestamp": "2026-05-12T14:30:00Z",
    "deviceId": "FLOOD_SENSOR_001",
    "hazardType": "FLOOD",
    "depth": 1.5
  }'
```

### Test 5: Read APIs

```bash
# List incidents
curl http://localhost:8082/api/v1/incidents?district=Colombo | jq .

# List alerts
curl http://localhost:8082/api/v1/alerts | jq .
```

---

## KEY FILES

| File | What it does |
|------|--------------|
| `j1.../app/j2_client.py` | HTTP client, retry logic |
| `j1.../app/validation.py` | Field validation |
| `j1.../app/routes/events.py` | POST /ingest/{report\|sensor} |
| `j2.../app/api/ingest.py` | INSERT, unique constraints |
| `j2.../app/api/routes.py` | GET /incidents, /alerts |

---

## STATUS CODES QUICK REFERENCE

| Code | Meaning | Action |
|------|---------|--------|
| `201` | Created ✅ | Success, remove from queue |
| `409` | Conflict | Duplicate, already done, remove from queue |
| `422` | Invalid | Bad data, show error, DON'T retry |
| `503` | Unavailable | J2 down, keep in queue, retry later |
| `500` | Server error | Unexpected, log and retry |

---

## DEBUGGING CHECKLIST

- [ ] J1 can reach J2: `curl http://localhost:8082/api/v1/health`
- [ ] Postgres is running: `psql ... -c "SELECT 1"`
- [ ] eventId in Postgres: `SELECT * FROM "IncomingReport" WHERE "eventId"='...'`
- [ ] Check logs: `tail -f container.log | grep error`
- [ ] Verify unique constraint: `\d "IncomingReport"` (in psql)
- [ ] Test offline flow: query mobile SQLite `/databases/offline.db`

---

## ENVIRONMENT VARIABLES

### J1
```
J2_BASE_URL=http://j2:8082
J2_SECRET_TOKEN=dev-secret
CORS_ORIGINS=*
IDEMPOTENCY_MAX_KEYS=50000
```

### J2
```
DATABASE_URL=postgresql://user:pass@host/db
```

---

## COMMON ERRORS & FIXES

| Error | Cause | Fix |
|-------|-------|-----|
| `Connection refused` | J2 not running | Start J2: `python -m uvicorn ...` |
| `Unique constraint violation` | Duplicate eventId already in DB | This should NOT happen (check constraint) |
| `Validation failed` | Missing required field | Check schema, add field, retry |
| `J2 service unavailable` | J2 down, J1 retried 3x | Wait, J1 returns 503 to mobile |

---

## DEPLOYMENT COMMANDS

### Docker Build

```bash
cd j1-device-edge/backend && docker build -t j1:v2 .
cd j2-data-intelligence && docker build -t j2:v2 .
```

### Kubernetes Deploy

```bash
# J2 first (must be ready)
kubectl apply -f k8s/j2-deployment.yaml

# Then J1
kubectl apply -f k8s/j1-deployment.yaml

# Verify
kubectl get pods
kubectl logs deployment/j1
kubectl logs deployment/j2
```

### Docker Compose (Local)

```bash
docker-compose up -d postgres j1 j2
docker-compose logs -f
docker-compose down
```

---

## ONE-LINE TESTS

```bash
# Health
curl http://localhost:8081/health && curl http://localhost:8082/api/v1/health

# Report ingestion
curl -s -X POST http://localhost:8081/api/v1/ingest/report -H "Content-Type: application/json" -H "Idempotency-Key: test-1" -d '{"eventId":"test-1","timestamp":"2026-05-12T14:30:00Z","deviceId":"M1","disasterType":"FLOOD","district":"Colombo","latitude":6.9,"longitude":80.7,"description":"Water overflowing"}' | jq '.data.status'

# Check database
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"IncomingReport\""

# Check logs
kubectl logs -f deployment/j1 | grep -i error
```

---

## PERFORMANCE TARGETS

| Metric | Target |
|--------|--------|
| J1 Ingestion latency | < 100ms |
| J2 Write latency | < 10ms |
| End-to-end latency | < 500ms |
| Duplicate rejection | < 1ms |
| Error rate | < 1% |

---

## RESOURCES

- **Full Design**: `ARCHITECTURE_REFACTOR_PLAN.md`
- **Implementation**: `J1_J2_IMPLEMENTATION_GUIDE.md`
- **Testing**: `ROLLOUT_AND_TESTING_GUIDE.md`
- **Summary**: `SIMPLIFICATION_PROJECT_SUMMARY.md`

---

## TEAM CONTACTS

- **Backend Questions**: Ask whoever wrote the code
- **Architecture Questions**: Refer to docs, ask team lead
- **Deployment Issues**: DevOps lead

---

## PRO TIPS

1. **Always send Idempotency-Key header** — prevents accidental duplicates
2. **Check idempotency store size** — if 50k, service has been up a long time
3. **Use curl -v for debugging** — see full request/response headers
4. **Monitor J2 retry rate** — if > 5%, something is wrong
5. **Test offline first** — mobile SQLite before network
6. **Keep unique constraints** — they save lives (of your database)

---

**Keep it simple. Test locally. Deploy with confidence.**
