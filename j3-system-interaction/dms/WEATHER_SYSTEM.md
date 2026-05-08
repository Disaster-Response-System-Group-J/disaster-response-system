# Weather Data System Documentation

## Overview

The disaster response system includes an automated weather data collection and aggregation system that:
- Fetches weather data from **OpenMeteO API** for all 121 Sri Lankan divisions
- Stores daily aggregated data in PostgreSQL (Supabase)
- Aggregates hourly soil moisture readings into daily averages
- Runs automated daily collection at a configurable time (default: 02:00 UTC)

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Weather System                             │
├─────────────────────────────────────────────────────────────┤
│
├─ lib/openmeteo.ts
│  └─ fetchOpenMeteoData() → Calls OpenMeteO API for date range
│  └─ processWeatherData() → Aggregates hourly → daily data
│  └─ aggregateSoilMoistureToDaily() → Average 24 hourly readings
│  └─ mapSoilMoistureLayers() → Maps OpenMeteO layers to DB schema
│
├─ lib/weather-db.ts
│  └─ saveRainfallData()
│  └─ saveSoilMoistureData()
│  └─ saveTemperatureData()
│  └─ saveAllWeatherData() → Save all 3 weather types atomically
│
├─ lib/weather-scheduler.ts
│  └─ fetchAndSaveWeatherForDivision() → Process single division
│  └─ fetchAndSaveWeatherForAllDivisions() → Process all 121 divisions
│  └─ scheduleDailyWeatherFetch() → Schedule 24-hour recurring task
│
├─ lib/weather-init.ts
│  └─ initializeWeatherSystem() → Setup scheduler + 7-day backfill
│  └─ performHistoricalBackfill() → Fetch last 7 days on startup
│
├─ app/layout.tsx
│  └─ Calls initializeWeatherSystem() on app startup
│
├─ app/api/weather/route.ts
│  └─ GET /api/weather → System status endpoint
│
├─ app/api/weather/fetch/route.ts
│  └─ GET /api/weather/fetch → Show usage
│  └─ POST /api/weather/fetch → Manual trigger with daysBack parameter
│
└─ app/api/weather/scheduler/route.ts
   └─ GET /api/weather/scheduler → Query scheduler status
   └─ POST /api/weather/scheduler → Start/stop/restart scheduler
```

## Data Flow

### 1. Initialization (App Startup)

```
App Starts (Next.js Server)
    ↓
initializeWeatherSystem() called (app/layout.tsx)
    ↓
Check if backfill already done
    ├─ NO → performHistoricalBackfill()
    │         ├─ fetchAndSaveWeatherForAllDivisions(daysBack=7)
    │         └─ Stores last 7 days for all 121 divisions
    │
    └─ YES → Skip backfill
    ↓
scheduleDailyWeatherFetch(time="02:00")
    └─ Weather fetch now scheduled for 02:00 UTC daily
```

### 2. OpenMeteO API Call (Per Division)

```
fetchOpenMeteoData(lat, lon, daysBack=7)
    ↓
OpenMeteO API Request:
  Daily: rain_sum, apparent_temperature_max, apparent_temperature_min
  Hourly: soil_moisture_0_to_1cm, soil_moisture_1_to_3cm, soil_moisture_3_to_9cm
    ↓
Response (24 hourly readings per day)
    ↓
processWeatherData()
    ├─ For each daily record:
    │   ├─ rainSum → Use daily total
    │   ├─ temperature → Average of max/min
    │   └─ soilMoisture → Average of 24 hourly readings
    │       (aggregateSoilMoistureToDaily)
    │
    └─ Returns AggregatedData[] (1 record per day)
```

### 3. Soil Moisture Aggregation (Hourly → Daily)

**Input:** 24 hourly soil moisture readings from OpenMeteO
```
OpenMeteO Layers (cm depth):
  - 0-1 cm (surface)
  - 1-3 cm (shallow)
  - 3-9 cm (moderate)
```

**Process:**
```
For each layer:
  ├─ Filter 24 hourly readings for target date
  ├─ Remove NULL values
  └─ Calculate average of remaining values
     (24 readings → 1 average value per layer per day)
```

**Output:** Daily aggregated soil moisture for 3 layers

### 4. Layer Mapping (OpenMeteO → Database)

```
OpenMeteO Layers          →    Database Columns
─────────────────────────      ─────────────────
0-1 cm                    →    moisture_7_28cm (shallow layer proxy)
1-3 cm + 3-9 cm (avg)    →    moisture_28_100cm (mid layer proxy)
3-9 cm                    →    moisture_100_255cm (deep layer proxy)
```

### 5. Database Storage (Upsert Pattern)

```
For each daily aggregated data:
    ↓
saveAllWeatherData(divisionId, date, data)
    ├─ saveRainfallData()
    │   └─ INSERT new OR UPDATE existing on (divisionId, date)
    │
    ├─ saveSoilMoistureData()
    │   └─ INSERT new OR UPDATE existing on (divisionId, date)
    │
    └─ saveTemperatureData()
        └─ INSERT new OR UPDATE existing on (divisionId, date)
```

## Database Schema

### RainfallData Table
```sql
CREATE TABLE "RainfallData" (
  rainfall_id SERIAL PRIMARY KEY,
  division_id INT NOT NULL REFERENCES "Division"(division_id),
  date DATE NOT NULL,
  rain_sum FLOAT8,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(division_id, date)
);
```

### SoilMoisture Table
```sql
CREATE TABLE "SoilMoisture" (
  soil_id SERIAL PRIMARY KEY,
  division_id INT NOT NULL REFERENCES "Division"(division_id),
  date DATE NOT NULL,
  moisture_7_28cm FLOAT8,
  moisture_28_100cm FLOAT8,
  moisture_100_255cm FLOAT8,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(division_id, date)
);
```

### TemperatureData Table
```sql
CREATE TABLE "TemperatureData" (
  temp_id SERIAL PRIMARY KEY,
  division_id INT NOT NULL REFERENCES "Division"(division_id),
  date DATE NOT NULL,
  temperature FLOAT8,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(division_id, date)
);
```

## Configuration

### Environment Variables (.env.local)

```bash
# Database Connection
DATABASE_URL=postgresql://postgres:PASSWORD@host:5432/postgres

# Weather System Configuration
WEATHER_FETCH_TIME=02:00          # Daily execution time (24-hour UTC format)
WEATHER_ENABLED=true              # Enable/disable the entire weather system
```

### Example .env.local
```
DATABASE_URL=postgresql://postgres:DisasterMangementSystem%40j2@db.qfhmczryyyddgitnlndy.supabase.co:5432/postgres
WEATHER_FETCH_TIME=02:00
WEATHER_ENABLED=true
```

## API Endpoints

### 1. Weather System Status
**GET** `/api/weather`

Returns operational status and available endpoints.

**Response:**
```json
{
  "success": true,
  "status": "Weather system operational",
  "scheduler": {
    "active": true,
    "lastRun": "2024-01-15T02:00:00Z",
    "nextRun": "2024-01-16T02:00:00Z",
    "scheduleTime": "02:00 UTC"
  }
}
```

### 2. Manual Weather Fetch
**POST** `/api/weather/fetch`

Manually trigger weather data fetch for all divisions.

**Request Body:**
```json
{
  "daysBack": 7  // Optional, default: 7, range: 1-30
}
```

**Examples:**
```bash
# Fetch today's data only
curl -X POST http://localhost:3000/api/weather/fetch \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 1}'

# Fetch last 7 days (default)
curl -X POST http://localhost:3000/api/weather/fetch \
  -H "Content-Type: application/json" \
  -d '{}'

# Fetch last 14 days
curl -X POST http://localhost:3000/api/weather/fetch \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 14}'
```

**Response:**
```json
{
  "success": true,
  "message": "Weather data fetch completed for 7 days",
  "data": {
    "success": 121,
    "failed": 0,
    "errors": []
  }
}
```

### 3. Scheduler Management
**GET/POST** `/api/weather/scheduler`

Query or control the scheduler.

**GET Response:**
```json
{
  "status": "active",
  "taskId": "weather-fetch-1234567890",
  "scheduleTime": "02:00 UTC",
  "lastRun": "2024-01-15T02:00:00Z",
  "nextRun": "2024-01-16T02:00:00Z"
}
```

**POST Start Scheduler:**
```bash
curl -X POST http://localhost:3000/api/weather/scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "time": "02:00"}'
```

## Execution Flow

### Daily Automated Run (02:00 UTC)

```
Timer triggers at 02:00 UTC
    ↓
For each of 121 divisions:
    ├─ Fetch from OpenMeteO (daysBack=1 for today only)
    ├─ Extract daily rainfall, temp, soil moisture
    ├─ Aggregate 24 hourly SM readings → 1 daily value per layer
    ├─ Save to RainfallData, TemperatureData, SoilMoisture tables
    ├─ Wait 100ms (API rate limiting)
    └─ Move to next division
    ↓
Log: "Daily fetch completed: 121 succeeded, 0 failed"
```

**Timing:**
- 121 divisions × ~500ms per division = ~60 seconds
- Runs daily at configured time (default: 02:00 UTC)

### One-Time Historical Backfill (App Startup)

```
App starts → initializeWeatherSystem()
    ↓
For each of 121 divisions:
    ├─ Fetch from OpenMeteO (daysBack=7 for last 7 days)
    ├─ Process 7 daily records per division
    ├─ Aggregate hourly → daily for each day
    ├─ Save all 7 days to database
    ├─ Wait 100ms (API rate limiting)
    └─ Move to next division
    ↓
Mark: WEATHER_BACKFILL_COMPLETED = true
    ↓
Start daily scheduler at configured time
```

**Timing:**
- 121 divisions × 7 days × ~500ms per division = ~7 minutes
- Runs once on app startup

## Hourly-to-Daily Aggregation Details

### Algorithm

**Input:** 24 hourly soil moisture readings for a specific date
```
time[0]:   2024-01-15T00:00:00 → soil_moisture_3_to_9cm: 25.4
time[1]:   2024-01-15T01:00:00 → soil_moisture_3_to_9cm: 25.1
...
time[23]:  2024-01-15T23:00:00 → soil_moisture_3_to_9cm: 26.2
```

**Processing:**
```
1. Filter hourly readings where date matches target date
   → Find indices where time.toDateString() == target date
   → Result: [0, 1, 2, ..., 23] (24 indices)

2. For each soil moisture layer:
   a. Extract values at matching indices
   b. Filter out NULL values
   c. Calculate average
   d. Result: 1 value per layer

3. Returns: 3 daily aggregates
   {
     soil_7_28cm: 25.5,      // Average of 24 readings
     soil_28_100cm: 24.8,    // Average of weighted readings
     soil_100_255cm: 26.1    // Average of 24 readings
   }
```

**Example Aggregation:**
```
OpenMeteO hourly readings (3-9cm layer):
[25.4, 25.1, 25.3, 25.2, 25.5, 25.6, 25.7, 25.8, 25.9, 26.0,
 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.5, 26.4, 26.3, 26.2,
 26.1, 26.0, 25.9, 25.8]

Average = Sum / Count = 626.1 / 24 = 26.088

Stored: moisture_100_255cm = 26.1 (rounded)
```

## Data Coverage

### Geographic Coverage
- **121 divisions** across all 9 provinces of Sri Lanka
- Each division has: latitude, longitude, district, province
- All coordinates sourced from official Sri Lankan spatial data

### Temporal Coverage
- **Historical:** 7 days on app startup
- **Ongoing:** Daily at 02:00 UTC via scheduler
- **Retention:** Infinite (PostgreSQL will retain all history)

### Weather Variables
| Variable | Source | Aggregation | Storage |
|----------|--------|-------------|---------|
| Rainfall | OpenMeteO daily | Total mm/day | `RainfallData.rain_sum` |
| Temperature | OpenMeteO daily | Avg of max/min | `TemperatureData.temperature` |
| Soil Moisture (0-1cm) | OpenMeteO hourly | Avg of 24 readings | `SoilMoisture.moisture_7_28cm` |
| Soil Moisture (1-3cm) | OpenMeteO hourly | Avg of 24 readings | `SoilMoisture.moisture_28_100cm` |
| Soil Moisture (3-9cm) | OpenMeteO hourly | Avg of 24 readings | `SoilMoisture.moisture_100_255cm` |

## Implementation Steps

### 1. Database Setup
```bash
# Run Prisma migration to create tables
npm run prisma:migrate dev

# Verify tables exist
# Check: RainfallData, SoilMoisture, TemperatureData
```

### 2. Seed Division Data
```bash
# Option A: Via Prisma seed script
npm run prisma:seed

# Option B: Manual via API
curl -X POST http://localhost:3000/api/divisions/seed

# Option C: Via SQL script
# Run prisma/update_division_population.sql in Supabase
```

### 3. Environment Configuration
```bash
# Edit .env.local
WEATHER_FETCH_TIME=02:00      # Adjust if needed
WEATHER_ENABLED=true           # Enable weather system
```

### 4. Start Application
```bash
npm run dev

# App will automatically:
# 1. Initialize weather system
# 2. Perform 7-day historical backfill
# 3. Schedule daily fetch at configured time
# 4. Start serving API endpoints
```

### 5. Verify System (Manual/API)
```bash
# Check weather system status
curl http://localhost:3000/api/weather

# Manually trigger fetch (optional)
curl -X POST http://localhost:3000/api/weather/fetch \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 1}'

# Query divisions with weather data
curl 'http://localhost:3000/api/divisions?limit=5'
```

## Monitoring & Troubleshooting

### Logs to Monitor

**On App Startup:**
```
[Weather Init] Initializing weather system...
[Weather Init] No backfill detected. Performing 7-day backfill...
[Weather Fetch] Starting weather data fetch for all divisions (7 days)
[Weather Fetch] Found 121 divisions to process
[OpenMeteO] Fetching 7 days of data from 2024-01-08 to 2024-01-15
[Weather Fetch] Saved weather data for Ududumbara (7 days)
...
[Weather Init] Historical backfill marked complete
[Weather Scheduler] Scheduling daily weather fetch at 02:00 UTC
[Weather Scheduler] Weather fetch scheduled successfully. Task ID: weather-fetch-1234567890
```

**On Daily Scheduled Run (02:00 UTC):**
```
[Weather Scheduler] Starting scheduled daily weather fetch at 02:00 UTC (today only)
[Weather Fetch] Starting weather data fetch for all divisions (1 days)
[Weather Fetch] Found 121 divisions to process
[OpenMeteO] Fetching 1 days of data from 2024-01-15 to 2024-01-15
[Weather Fetch] Saved weather data for Ududumbara (1 days)
...
[Weather Scheduler] Daily fetch completed: 121 divisions succeeded, 0 failed
```

### Common Issues

**Issue:** "No divisions found with valid coordinates"
```
Solution: 
1. Check Division table has been seeded (npm run prisma:seed)
2. Verify division records have latitude/longitude values
3. Run: SELECT COUNT(*) FROM "Division" WHERE latitude IS NOT NULL;
```

**Issue:** OpenMeteO API rate limiting errors
```
Solution:
1. System implements 100ms delay between API calls
2. For faster processing, increase delay in weather-scheduler.ts
3. Or fetch fewer divisions per run
```

**Issue:** Database connection fails
```
Solution:
1. Verify DATABASE_URL in .env.local
2. Test connection: npx prisma db execute --stdin < test.sql
3. Check Supabase credentials and hostname
```

**Issue:** Weather data not being stored
```
Solution:
1. Check Prisma migration was applied: npm run prisma:migrate status
2. Verify Division table exists and has records
3. Check console logs for errors during fetch
4. Try manual trigger: curl -X POST http://localhost:3000/api/weather/fetch
```

## Performance Characteristics

### API Performance
| Operation | Time | Note |
|-----------|------|------|
| Fetch 1 division (7 days) | ~500ms | Includes OpenMeteO API call |
| Fetch 1 division (1 day) | ~200ms | Minimal data |
| Process 121 divisions (7 days) | ~7 minutes | With 100ms rate limiting |
| Process 121 divisions (1 day) | ~2 minutes | Daily scheduled run |
| Aggregate 24 hourly readings | ~10ms | Per-layer calculation |
| Database upsert | ~50ms | Per-date-division combo |

### Storage
| Table | Records (per run) | Storage per year |
|-------|-------------------|------------------|
| RainfallData | 121 | ~44 KB |
| SoilMoisture | 121 | ~88 KB |
| TemperatureData | 121 | ~44 KB |
| **Total** | 363 | **~176 KB/day** |

*Storage calculated for 121 divisions × 1 record/day × 365 days*

## Future Enhancements

- [ ] Add caching layer for repeated requests
- [ ] Implement webhook notifications for extreme weather
- [ ] Add GraphQL API for weather data queries
- [ ] Create data validation rules (e.g., soil moisture bounds)
- [ ] Add weather forecasting (OpenMeteO forecast API)
- [ ] Implement data compression for historical storage
- [ ] Add alerting for missing data
- [ ] Create dashboard visualizations
