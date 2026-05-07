# Weather Data System - Quick Start Guide

## System Status

✅ **Implemented:**
- OpenMeteO API integration (fetches weather for all 121 divisions)
- Hourly soil moisture aggregation → daily averages (24 readings per layer)
- **7-day historical backfill on app startup** (NEW)
- Daily automated scheduler (runs at 02:00 UTC, fetches today only)
- 3 weather data tables: RainfallData, SoilMoisture, TemperatureData
- API endpoints for manual triggers and monitoring

## Quick Start

### Step 1: Apply Database Migrations
```bash
cd j3-system-interaction/dms

# Create the weather data tables
npm run prisma:migrate dev

# Follow the prompts and accept creation
```

### Step 2: Seed Division Data
```bash
# Populate 121 divisions with location details
npm run prisma:seed

# OR manually via API:
curl -X POST http://localhost:3000/api/divisions/seed
```

### Step 3: Start the Application
```bash
npm run dev

# Watch logs for:
# [Weather Init] Initializing weather system...
# [Weather Fetch] Starting weather data fetch for all divisions (7 days)
# [Weather Init] Historical backfill marked complete
# [Weather Scheduler] Weather fetch scheduled successfully at 02:00 UTC
```

**Expected Duration:** ~7-10 minutes (first run includes 7-day backfill)

### Step 4: Verify Data Collection
```bash
# Check weather system status
curl http://localhost:3000/api/weather

# Query collected weather data
curl 'http://localhost:3000/api/divisions?limit=3' | jq

# Should show divisions with population data
```

## Manual Operations

### Fetch Weather for All 121 Divisions (Today)
```bash
curl -X POST http://localhost:3000/api/weather/fetch \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 1}'
```

### Fetch Last 7 Days (Backfill)
```bash
curl -X POST http://localhost:3000/api/weather/fetch \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 7}'
```

### Fetch Last 14 Days
```bash
curl -X POST http://localhost:3000/api/weather/fetch \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 14}'
```

### Check Scheduler Status
```bash
curl http://localhost:3000/api/weather/scheduler
```

## What Happens Automatically

### On App Startup
1. Checks if 7-day backfill was already completed
2. If NOT: Fetches last 7 days for all 121 divisions from OpenMeteO
   - 24 hourly soil moisture readings → 1 daily average per layer
   - Daily rainfall total and temperature average
   - All data saved to PostgreSQL with upsert (no duplicates)
3. Starts daily scheduler at 02:00 UTC

### Daily at 02:00 UTC
1. Fetches **today's data only** for all 121 divisions
2. Aggregates hourly soil moisture readings to daily average
3. Saves to database with upsert pattern
4. Logs success/failure counts

## Data Flow

```
OpenMeteO API
  ↓ (latitude, longitude, daysBack=7)
  ├─ Daily Data: rain_sum, temperature
  └─ Hourly Data: 24 soil moisture readings per layer
    ↓
Aggregation (lib/openmeteo.ts)
  ├─ 24 hourly readings → 1 daily average
  ├─ Rainfall: Total mm/day
  ├─ Temperature: Avg of max/min
  └─ Soil Moisture: Avg per layer
    ↓
Database (PostgreSQL - Supabase)
  ├─ RainfallData (121 records/day)
  ├─ SoilMoisture (121 records/day)
  └─ TemperatureData (121 records/day)
```

## Environment Configuration

**File:** `.env.local`

```bash
# Supabase Database Connection
DATABASE_URL=postgresql://postgres:DisasterMangementSystem%40j2@db.qfhmczryyyddgitnlndy.supabase.co:5432/postgres

# Weather System Configuration
WEATHER_FETCH_TIME=02:00    # Daily fetch time (UTC, 24-hour format)
WEATHER_ENABLED=true         # Enable/disable weather collection
```

**Adjust daily run time** (if needed):
```bash
# Change to 06:00 UTC instead of 02:00
WEATHER_FETCH_TIME=06:00
```

## Soil Moisture Details

### Hourly → Daily Aggregation

**What we receive from OpenMeteO:**
- 24 hourly soil moisture readings per day
- For 3 soil depth layers: 0-1cm, 1-3cm, 3-9cm

**What we store in database:**
- 1 daily average per layer (24 readings → 1 aggregated value)
- 3 soil moisture columns: moisture_7_28cm, moisture_28_100cm, moisture_100_255cm

**Example:**
```
Hourly readings for 3-9cm layer (24 values):
[25.4, 25.1, 25.3, 25.2, 25.5, ... 25.8]

Daily average:
(25.4 + 25.1 + 25.3 + ... + 25.8) / 24 = 26.1

Stored: SoilMoisture.moisture_100_255cm = 26.1
```

## Coverage

- **Divisions:** 121 (all of Sri Lanka)
- **Weather Variables:** Rainfall, Temperature, Soil Moisture (3 layers)
- **Temporal Range:** 7-day backfill + daily ongoing
- **Update Frequency:** Daily at 02:00 UTC
- **Data Availability:** Immediate (stored within 2-3 minutes after API call)

## Monitoring Logs

When working correctly, you should see:

**First startup:**
```
[Weather Init] Initializing weather system...
[Weather Fetch] Starting weather data fetch for all divisions (7 days)
[Weather Fetch] Found 121 divisions to process
[OpenMeteO] Fetching 7 days of data from 2024-01-08 to 2024-01-15
[Weather Fetch] Saved weather data for Ududumbara (7 days)
... (119 more divisions)
[Weather Scheduler] Weather fetch scheduled at 02:00 UTC
```

**Daily at 02:00 UTC:**
```
[Weather Scheduler] Starting scheduled daily weather fetch (today only)
[Weather Fetch] Starting weather data fetch for all divisions (1 days)
[Weather Fetch] Found 121 divisions to process
[OpenMeteO] Fetching 1 days of data from 2024-01-15 to 2024-01-15
[Weather Fetch] Saved weather data for Ududumbara (1 days)
... (119 more divisions)
[Weather Scheduler] Daily fetch completed: 121 succeeded, 0 failed
```

## Troubleshooting

### Issue: Backfill takes too long
**Solution:** It's normal. ~7 minutes for first backfill (7 days × 121 divisions)

### Issue: Some divisions fail
**Solution:** 
1. Check console logs for specific division names
2. Verify those divisions have valid latitude/longitude in database
3. OpenMeteO may be rate limiting - wait a few minutes and retry

### Issue: No data in database after running
**Solution:**
1. Verify Prisma migration was applied: `npm run prisma:migrate status`
2. Check DATABASE_URL is correct in `.env.local`
3. Verify divisions table has data: `SELECT COUNT(*) FROM "Division";`
4. Check console for errors

### Issue: Scheduler doesn't run at 02:00 UTC
**Solution:**
1. Check WEATHER_FETCH_TIME in .env.local
2. Verify WEATHER_ENABLED=true
3. Check server timezone (times are UTC, not local)
4. Manually trigger: `curl -X POST http://localhost:3000/api/weather/fetch`

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/weather` | GET | System status |
| `/api/weather/fetch` | POST | Manual trigger (body: {daysBack: 1-30}) |
| `/api/weather/scheduler` | GET | Scheduler status |
| `/api/divisions` | GET | List divisions with weather data |

## Files Created/Modified

**New Files:**
- `WEATHER_SYSTEM.md` - Comprehensive documentation
- `lib/openmeteo.ts` - OpenMeteO API integration
- `lib/weather-db.ts` - Database operations
- `lib/weather-scheduler.ts` - Scheduling engine
- `lib/weather-init.ts` - App initialization
- `app/api/weather/route.ts` - Status endpoint
- `app/api/weather/fetch/route.ts` - Fetch trigger endpoint
- `app/api/weather/scheduler/route.ts` - Scheduler management

**Modified Files:**
- `prisma/schema.prisma` - Weather data models
- `app/layout.tsx` - Init weather system on startup
- `package.json` - Added csv-parser dependency

## Next Steps

1. ✅ Run `npm run prisma:migrate dev`
2. ✅ Run `npm run prisma:seed`
3. ✅ Start app: `npm run dev`
4. ✅ Verify logs show backfill + scheduler starting
5. ✅ Wait for 7-day backfill to complete
6. ✅ Manually query data to confirm storage
7. ✅ System will automatically fetch at 02:00 UTC daily

## Support

For detailed information, see [WEATHER_SYSTEM.md](./WEATHER_SYSTEM.md)

Key sections:
- Architecture overview
- Data flow diagrams
- Hourly→daily aggregation algorithm
- Database schema
- Performance characteristics
- Troubleshooting guide
