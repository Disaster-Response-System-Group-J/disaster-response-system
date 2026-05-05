# Weather Data Integration System

Automated daily weather data fetching from OpenMeteO API with intelligent soil moisture aggregation.

## Overview

This system automatically fetches weather data from [OpenMeteO API](https://open-meteo.com/) daily and stores it in your disaster response system database. It handles:

- **Rainfall Data**: Daily rain sum (mm)
- **Temperature Data**: Daily apparent temperature (°C)
- **Soil Moisture**: Aggregates hourly OpenMeteO data (0-1cm, 1-3cm, 3-9cm) to daily averages mapped to database layers (7-28cm, 28-100cm, 100-255cm)

## Architecture

### Components

1. **`lib/openmeteo.ts`** - OpenMeteO API client
   - Fetches raw weather data from API
   - Aggregates hourly soil moisture to daily values
   - Processes and validates data

2. **`lib/weather-db.ts`** - Database operations
   - Saves weather data with upsert (create or update)
   - Retrieves divisions for fetching
   - Queries latest weather data

3. **`lib/weather-scheduler.ts`** - Scheduling engine
   - Daily scheduled execution (configurable time)
   - Manual fetch triggers
   - Task lifecycle management

4. **API Routes**
   - `GET/POST /api/weather/scheduler` - Manage scheduler (start/stop/restart)
   - `POST /api/weather/fetch` - Manual trigger
   - `GET /api/weather` - System status

## Setup

### 1. Update Prisma Schema

Schema has been updated with weather data models:
- `Division` - Geographic areas with coordinates
- `RainfallData` - Daily rainfall measurements
- `SoilMoisture` - Daily soil moisture at different depths
- `TemperatureData` - Daily temperature readings
- Related models: `IoT_Device`, `BaseWaterLevel`, `FloodSeverity`, `DisasterRisk`, `SPI_Data`

### 2. Run Database Migrations

```bash
cd j3-system-interaction/dms

# Generate Prisma client
npm run prisma generate

# Apply migrations
npm run prisma migrate dev --name "add_weather_data_models"

# Or push to database
npm run prisma db push
```

### 3. Populate Division Table

Before fetching data, ensure your `Division` table has entries with valid latitude/longitude coordinates:

```sql
INSERT INTO "Division" (name, district, latitude, longitude) VALUES
  ('Division Name', 'District Name', 52.52, 13.41),
  ...;
```

Or via Prisma:

```typescript
await prisma.division.create({
  data: {
    name: "Colombo District",
    district: "Western",
    latitude: 6.9271,
    longitude: 80.6369,
  }
});
```

## Usage

### Option 1: Automatic Daily Scheduling

Start the scheduler at application startup:

```typescript
// In your Next.js initialization (e.g., layout.tsx or middleware)
import { scheduleDailyWeatherFetch } from "@/lib/weather-scheduler";

// Call once during app initialization
scheduleDailyWeatherFetch("02:00"); // Runs daily at 2 AM UTC
```

Or via API:

```bash
curl -X POST http://localhost:3000/api/weather/scheduler \
  -H "Content-Type: application/json" \
  -d '{
    "action": "start",
    "scheduleTime": "02:00",
    "runNow": true
  }'
```

### Option 2: Manual Fetch

Trigger immediate data fetch:

```bash
curl -X POST http://localhost:3000/api/weather/fetch
```

Fetch historical data for specific date:

```bash
curl -X POST http://localhost:3000/api/weather/fetch \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-01-15"}'
```

### Option 3: Check Scheduler Status

```bash
curl http://localhost:3000/api/weather/scheduler
```

Response:
```json
{
  "success": true,
  "scheduler": {
    "active": true,
    "taskId": "weather-fetch-1704067200000",
    "scheduleTime": "02:00",
    "startedAt": "2024-01-01T02:00:00.000Z",
    "activeTaskCount": 1
  }
}
```

### Stop/Restart Scheduler

```bash
# Stop
curl -X POST http://localhost:3000/api/weather/scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "stop"}'

# Restart with new time
curl -X POST http://localhost:3000/api/weather/scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "restart", "scheduleTime": "03:30"}'
```

## Data Mapping

### Soil Moisture Layers

OpenMeteO provides soil moisture at depths: **0-1cm**, **1-3cm**, **3-9cm**

Database schema requires: **7-28cm**, **28-100cm**, **100-255cm**

**Current Mapping** (Simplified):
- `moisture_7_28cm` ← OpenMeteO `soil_moisture_1_to_3cm`
- `moisture_28_100cm` ← Average of `soil_moisture_1_to_3cm` + `soil_moisture_3_to_9cm`
- `moisture_100_255cm` ← OpenMeteO `soil_moisture_3_to_9cm`

**Note**: This mapping provides a reasonable approximation. For more accurate predictions, consider:
1. Calibrating with local soil measurements
2. Using soil texture and hydraulic properties
3. Applying pedotransfer functions (PTF)

### Example Aggregation

**Hourly Data (from OpenMeteO):**
```
2024-01-15 00:00 - soil 0-1cm: 45%, 1-3cm: 50%, 3-9cm: 55%
2024-01-15 01:00 - soil 0-1cm: 44%, 1-3cm: 51%, 3-9cm: 56%
... (24 readings)
```

**Aggregated to Daily:**
```
2024-01-15 - Daily avg 0-1cm: 45.2%, 1-3cm: 50.5%, 3-9cm: 55.8%
```

**Mapped to Database:**
```sql
INSERT INTO "SoilMoisture" (division_id, date, moisture_7_28cm, moisture_28_100cm, moisture_100_255cm)
VALUES (1, '2024-01-15', 50.5, 53.15, 55.8)
```

## API Limits & Performance

- **OpenMeteO Free Plan**: 10,000 API calls/month, 100 calls/day
- **Rate Limiting**: 100ms delay between division fetches
- **Processing Time**: ~50-100ms per division depending on network
- **Database**: Upsert queries prevent duplicates

For 50 divisions:
- ~5-10 seconds total fetch time
- ~1-2 second database operations
- **Total: ~10-15 seconds per run**

## Error Handling

System logs all operations to console:

```
[Weather Fetch] Starting weather data fetch for all divisions
[Weather Fetch] Processing division: Colombo (1) at (6.9271, 80.6369)
[Weather Fetch] Saved weather data for Colombo on 2024-01-15
[Weather Scheduler] Completed: 50 succeeded, 0 failed
```

If a division fails:
- Error is logged with division name and ID
- Processing continues with next division
- Summary report shows success/failure counts

## Database Schema

### RainfallData
```sql
CREATE TABLE "RainfallData" (
  rainfall_id SERIAL PRIMARY KEY,
  division_id INTEGER REFERENCES "Division",
  date DATE NOT NULL,
  rain_sum FLOAT,
  createdAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(division_id, date)
);
```

### SoilMoisture
```sql
CREATE TABLE "SoilMoisture" (
  soil_id SERIAL PRIMARY KEY,
  division_id INTEGER REFERENCES "Division",
  date DATE NOT NULL,
  moisture_7_28cm FLOAT,
  moisture_28_100cm FLOAT,
  moisture_100_255cm FLOAT,
  createdAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(division_id, date)
);
```

### TemperatureData
```sql
CREATE TABLE "TemperatureData" (
  temp_id SERIAL PRIMARY KEY,
  division_id INTEGER REFERENCES "Division",
  date DATE NOT NULL,
  temperature FLOAT,
  createdAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(division_id, date)
);
```

## Environment Variables

Ensure `DATABASE_URL` is set in `.env.local`:

```env
DATABASE_URL="postgresql://j3user:j3password@localhost:5432/j3db"
```

## Troubleshooting

### No data appears in database

1. Check divisions have valid latitude/longitude:
   ```sql
   SELECT * FROM "Division" WHERE latitude IS NULL OR longitude IS NULL;
   ```

2. Verify API call manually:
   ```bash
   curl "https://api.open-meteo.com/v1/forecast?latitude=6.9271&longitude=80.6369&daily=rain_sum&hourly=soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm"
   ```

3. Check database connection:
   ```bash
   npm run prisma studio
   ```

### Scheduler not running

1. Verify scheduler was started:
   ```bash
   curl http://localhost:3000/api/weather/scheduler
   ```

2. Check application logs for errors

3. Ensure Next.js server is running:
   ```bash
   npm run dev
   ```

### Soil moisture values seem wrong

1. Review the mapping function in `lib/openmeteo.ts` - `mapSoilMoistureLayers()`
2. Calibrate with local soil measurements
3. Consider soil type and hydraulic properties

## Future Improvements

- [ ] Implement actual PTF calibration for soil moisture layers
- [ ] Add SPI (Standardized Precipitation Index) calculation
- [ ] Support for different timezone schedules
- [ ] Database connection pooling optimization
- [ ] Webhook notifications on data errors
- [ ] Historical data backfill utility
- [ ] Cron-based scheduler alternative (node-cron)

## References

- [OpenMeteO API Documentation](https://open-meteo.com/en/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Next.js API Routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes)

## License

Part of the Disaster Response System - Follow project license.
