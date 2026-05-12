# Implementation Index & Quick Start

**Project**: Disaster Response System - Kafka Removal & HTTP Integration  
**Status**: ✅ Complete  
**Start Date**: 2026-05-12  
**Target Go-Live**: 2026-05-19 (~7 days)  

---

## 📚 DOCUMENTATION ROADMAP

### For Quick Understanding (Read First)

1. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** (5 min)
   - Setup commands
   - Common test cases (copy-paste ready)
   - Quick troubleshooting
   - Status codes cheat sheet

2. **[SIMPLIFICATION_PROJECT_SUMMARY.md](SIMPLIFICATION_PROJECT_SUMMARY.md)** (10 min)
   - Executive summary
   - What changed
   - Architecture diagram
   - Timeline & team assignments

### For Implementation (Read Before Coding)

3. **[ARCHITECTURE_REFACTOR_PLAN.md](ARCHITECTURE_REFACTOR_PLAN.md)** (30 min)
   - Complete design details
   - Final schemas (ReportIngest, SensorIngest)
   - API design with examples
   - Database recommendations
   - Risk analysis & mitigation
   - **→ Use as reference while coding**

4. **[J1_J2_IMPLEMENTATION_GUIDE.md](J1_J2_IMPLEMENTATION_GUIDE.md)** (20 min)
   - Step-by-step implementation
   - J1 and J2 responsibilities
   - Integration flow diagrams
   - Validation rules
   - Idempotency strategy
   - Deployment checklist

### For Testing & Rollout (Read Before Testing)

5. **[ROLLOUT_AND_TESTING_GUIDE.md](ROLLOUT_AND_TESTING_GUIDE.md)** (40 min)
   - Phase-by-phase testing (Day 1-7)
   - Exact curl commands for each test
   - Performance testing procedures
   - Staging & production deployment
   - Rollback plan

---

## 🚀 QUICK START (30 seconds)

### TL;DR - What Changed?

- ❌ Removed: Kafka producer/consumer
- ✅ Added: HTTP direct forwarding J1 → J2
- ✅ Added: Database-level idempotency (unique constraints)
- ✅ Added: Validation & retry logic
- ⏸️ Not Changed: Postgres schema, mobile app, ML pipeline

### TL;DR - Setup

```bash
# Terminal 1: Database
docker-compose up postgres

# Terminal 2: J1
cd j1-device-edge/backend && pip install -r requirements.txt
export J2_BASE_URL=http://localhost:8082 && export J2_SECRET_TOKEN=dev-secret
python -m uvicorn app.main:app --reload --port 8081

# Terminal 3: J2
cd j2-data-intelligence && pip install -r requirements.txt
export DATABASE_URL=postgresql://user:pass@localhost:5432/db
python -m uvicorn app.main:app --reload --port 8082

# Terminal 4: Test
curl -X POST http://localhost:8081/api/v1/ingest/report \
  -H "Content-Type: application/json" \
  -d '{"eventId":"test-1","timestamp":"2026-05-12T14:30:00Z","deviceId":"M1",...}'
```

---

## 📋 FILES CHANGED

### Created (New Functionality)

```
j1-device-edge/backend/app/
├── j2_client.py          (NEW - HTTP client to J2 with retry)
└── validation.py         (NEW - field validation logic)

j2-data-intelligence/app/api/
└── ingest.py            (NEW - J2 ingestion endpoints)
```

### Modified (Existing Files)

```
j1-device-edge/backend/
├── requirements.txt      (removed Kafka, added httpx)
├── app/config.py         (added J2 settings)
├── app/models.py         (added schemas)
├── app/main.py           (use J2 client instead of Kafka)
└── app/routes/events.py  (complete rewrite → new endpoints)

j2-data-intelligence/
├── app/main.py           (include ingest router)
└── app/api/routes.py     (added read APIs)
```

### NOT Changed (Untouched)

```
✅ postgres/                (database schema intact)
✅ j3-system-interaction/   (dashboard uses new read APIs)
✅ j1-device-edge/mobile_app/  (Flutter app compatible)
✅ j1-device-edge/Backend Node Controllers/  (no changes)
```

---

## 🔍 WHAT EACH FILE DOES

### J1 New Files

**`app/j2_client.py`**
- Async HTTP client to J2
- Exponential backoff retry (1s, 2s, 4s, max 3)
- Handles connection errors, timeouts, 503/504/408
- Returns immediately on success or client error
- Safe for production use

**`app/validation.py`**
- Validates report fields (required, enum, range, phone)
- Validates sensor fields (at least 1 reading, coordinate pairs)
- Returns field-level errors for mobile display
- Raises ValidationError with field + reason

### J2 New Files

**`app/api/ingest.py`**
- POST `/api/v1/ingest/report` → INSERT ... ON CONFLICT DO NOTHING
- POST `/api/v1/ingest/sensor` → INSERT ... ON CONFLICT DO NOTHING + threshold check
- Returns 201 Created or 409 Conflict
- Checks sensor depth > 1.0m → generates alert

### J1 Modified Files

**`requirements.txt`**
```diff
- confluent-kafka==2.5.0
+ httpx==0.27.0
```

**`app/config.py`**
```python
J2_BASE_URL = os.getenv("J2_BASE_URL", "http://j2:8082")
J2_SECRET_TOKEN = os.getenv("J2_SECRET_TOKEN", "dev-secret-token")
J2_REQUEST_TIMEOUT = float(os.getenv("J2_REQUEST_TIMEOUT", "5.0"))
```

**`app/models.py`**
- Added `ReportIngestPayload` (from mobile)
- Added `SensorIngestPayload` (from mobile)
- Keep `EventPayload` for compatibility

**`app/main.py`**
```python
# Changed from:
from .kafka_producer import kafka_producer
kafka_producer.connect()

# To:
from .j2_client import j2_client
await j2_client.connect()
```

**`app/routes/events.py`**
- Completely rewritten
- POST `/api/v1/ingest/report` (was `/events/ingest`)
- POST `/api/v1/ingest/sensor` (was new)
- Validate → Forward to J2 → Return response
- Handle 201/409/422/503 status codes

### J2 Modified Files

**`app/main.py`**
```python
from app.api.ingest import router as ingest_router
app.include_router(ingest_router)
```

**`app/api/routes.py`**
- Added `GET /api/v1/incidents` (list confirmed incidents)
- Added `GET /api/v1/alerts` (list risk alerts)
- Query incidents by district or status
- Query alerts by district or severity

---

## 🗺️ IMPLEMENTATION PATHS

### Path 1: Backend Dev 1 (J1 Refactor)
```
Day 1:
  1. Read ARCHITECTURE_REFACTOR_PLAN.md (focus: schemas)
  2. Update requirements.txt (remove Kafka, add httpx)
  3. Create app/j2_client.py (copy from docs, adjust retry)
  4. Create app/validation.py (copy from docs, adjust rules)
  5. Update app/config.py (add J2 settings)
  6. Update app/models.py (add schemas)
  7. Update app/main.py (use j2_client)
  8. Update app/routes/events.py (new endpoints, use j2_client)
  9. Test locally with curl (see QUICK_REFERENCE.md)
  10. Check: No Kafka imports remain
```

### Path 2: Backend Dev 2 (J2 Setup)
```
Day 2:
  1. Read ARCHITECTURE_REFACTOR_PLAN.md (focus: DB design)
  2. Create app/api/ingest.py (copy from docs)
  3. Update app/main.py (include ingest router)
  4. Add read endpoints to app/api/routes.py (incidents, alerts)
  5. Update app/db/models.py if needed
  6. Test locally with curl (see QUICK_REFERENCE.md)
  7. Verify DB unique constraints work
  8. Check: J2 returns 201, 409, 500 correctly
```

### Path 3: DBA (Schema Changes)
```
Day 3:
  1. Review ARCHITECTURE_REFACTOR_PLAN.md (DB section)
  2. Backup production DB: pg_dump > backup.sql
  3. Run migrations (add unique constraints):
     - ALTER TABLE "IncomingReport" ADD UNIQUE ("eventId")
     - CREATE UNIQUE INDEX on iot_rainfall_data
  4. Verify no existing duplicates
  5. Test on staging DB first
```

### Path 4: QA (Testing)
```
Day 4-5:
  1. Read ROLLOUT_AND_TESTING_GUIDE.md
  2. Run Phase 1: Local dev testing (curl tests)
  3. Run Phase 3: Integration testing (end-to-end)
  4. Run Phase 4: Performance testing
  5. Document results, file any issues
  6. Approve go-live if all tests pass
```

### Path 5: DevOps (Deployment)
```
Day 6:
  1. Review J1_J2_IMPLEMENTATION_GUIDE.md
  2. Prepare staging environment
  3. Build Docker images (J1:v2, J2:v2)
  4. Deploy to staging (J2 first, then J1)
  5. Run smoke tests
  6. Prepare production deployment plan

Day 7:
  1. Schedule maintenance window
  2. Deploy to production (J2 first)
  3. Deploy J1 (will auto-forward)
  4. Monitor logs, metrics
  5. If issues: execute rollback plan (shouldn't be needed)
```

---

## ✅ PRE-IMPLEMENTATION CHECKLIST

- [ ] All team members read SIMPLIFICATION_PROJECT_SUMMARY.md
- [ ] Backend devs read ARCHITECTURE_REFACTOR_PLAN.md
- [ ] QA lead reads ROLLOUT_AND_TESTING_GUIDE.md
- [ ] DevOps lead reviews deployment sections
- [ ] Database backups taken
- [ ] Local dev environment ready (Docker, Python 3.11+)
- [ ] Postgres running locally
- [ ] Team alignment on 7-day timeline

---

## 📊 SUCCESS CRITERIA

**After implementation, verify:**

✅ Mobile → J1 → J2 → Postgres end-to-end works  
✅ Duplicate report returns 409 (not inserted twice)  
✅ Invalid field returns 422 with field-level error  
✅ Sensor threshold generates alert (depth > 1.0m)  
✅ J2 down → J1 returns 503 (mobile retries)  
✅ Dashboard shows live incidents and alerts  
✅ No Kafka in codebase (grep returns 0 results)  
✅ Zero test failures in Phase 1-4  

---

## 🚨 CRITICAL THINGS TO REMEMBER

1. **Database first**: Always deploy J2 before J1
2. **Unique constraints**: Add BEFORE deploying code
3. **Test locally**: Don't skip Phase 1 testing
4. **Idempotency key**: Mobile MUST send this header
5. **Retry logic**: J1 retries on 503, not on 422/409
6. **No Kafka**: Verify imports with grep
7. **Secret token**: Keep J2_SECRET_TOKEN in env vars
8. **Offline queue**: Mobile SQLite handles retries

---

## 🔧 COMMON CUSTOMIZATIONS

If your team needs to customize:

### Adjust Retry Backoff
File: `app/j2_client.py`, method `_backoff()`
```python
# Change from (1s, 2s, 4s) to (2s, 4s, 8s):
wait_time = self._base_backoff * (2 ** attempt)  # Edit this
# And change _base_backoff from 1.0 to 2.0
```

### Adjust Threshold Alert
File: `app/api/ingest.py`, method `ingest_sensor()`
```python
# Change from 1.0m to 1.5m:
if payload.depth > 1.5:  # Edit this
```

### Adjust Idempotency Store Size
File: `app/config.py`
```python
IDEMPOTENCY_MAX_KEYS = int(os.getenv("IDEMPOTENCY_MAX_KEYS", "50000"))  # Edit default
```

---

## 📞 SUPPORT

| Question | Answer | Document |
|----------|--------|----------|
| How does J1-J2 work? | Direct HTTP | ARCHITECTURE_REFACTOR_PLAN.md |
| How do I set up locally? | Follow QUICK_START | QUICK_REFERENCE.md |
| What fields are required? | Check schemas | J1_J2_IMPLEMENTATION_GUIDE.md |
| How do I test? | Use curl commands | ROLLOUT_AND_TESTING_GUIDE.md |
| How do I deploy? | Follow deployment | J1_J2_IMPLEMENTATION_GUIDE.md |
| What if something breaks? | Execute rollback | ROLLOUT_AND_TESTING_GUIDE.md |

---

## 📅 SUGGESTED DAILY STANDUP AGENDA

**Day 1**: J1 progress, blockers  
**Day 2**: J2 progress, validation feedback  
**Day 3**: DB migration status, rollback rehearsal  
**Day 4**: Test results, UAT readiness  
**Day 5**: Performance baseline, demo prep  
**Day 6**: Staging deployment, go/no-go decision  
**Day 7**: Production deployment, incident scenarios  

---

## 🎯 FINAL CHECKLIST BEFORE GO-LIVE

- [ ] All code merged to main
- [ ] All tests passing (Phase 1-5)
- [ ] DB migrations applied (staging + production backup)
- [ ] Monitoring configured (logs, metrics, alerts)
- [ ] Rollback plan rehearsed (never needed but practiced)
- [ ] Team trained on new endpoints
- [ ] Documentation complete and reviewed
- [ ] Go-live window scheduled
- [ ] On-call engineer assigned
- [ ] Post-incident review scheduled

---

## 💡 BEST PRACTICES

1. **Use curl for testing** — easier than writing Python
2. **Check logs frequently** — search for 'error' and 'ERROR'
3. **Keep unique constraints** — they prevent data corruption
4. **Monitor retry rate** — if > 5%, something is wrong
5. **Test offline flow** — most users experience this
6. **Keep secrets in env** — never hardcode credentials
7. **Use structured logging** — easier to parse and debug
8. **Document decisions** — helps future developers

---

## 🎓 LEARNING RESOURCES

- **FastAPI**: https://fastapi.tiangolo.com (request/response)
- **SQLAlchemy**: https://docs.sqlalchemy.org (ORM)
- **Pydantic**: https://docs.pydantic.dev (validation)
- **httpx**: https://www.python-httpx.org (async HTTP)
- **Postgres**: https://www.postgresql.org/docs (unique constraints)

---

## 📝 NOTES FOR TEAM

- This is a **simplification**, not an enhancement
- The goal is **stability**, not features
- We're **removing complexity**, not adding it
- **Keep it simple** — if it feels complex, it probably is
- **Test thoroughly** — local testing saves deployment headaches
- **Document everything** — future you will thank you
- **Ask questions** — clarify with team lead early

---

**You've got this. Keep it simple. Deploy with confidence.**

---

**Last Updated**: 2026-05-12  
**Status**: ✅ Ready for Implementation  
**Next Action**: Read QUICK_REFERENCE.md and start Day 1 setup
