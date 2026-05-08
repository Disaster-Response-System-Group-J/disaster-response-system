# Weather Integration - Quick Checklist

## ✅ Implementation Complete

All backend services have been created and integrated. Use this checklist to complete setup.

---

## Pre-Setup Verification

- [ ] Database is running (PostgreSQL)
- [ ] `.env.local` has `DATABASE_URL` configured
- [ ] Project dependencies are installed (`npm install`)

---

## Setup Steps (In Order)

### 1. Database Migration
```bash
cd j3-system-interaction/dms

# Generate Prisma client with new weather models
npm run prisma generate

# Apply migrations
npm run prisma migrate dev --name "add_weather_data_models"
# OR manually push schema
npm run prisma db push
```
- [ ] Migrations completed successfully
- [ ] No migration errors in console

### 2. Populate Division Table

Add your geographic divisions with coordinates. Choose one method:

**Option A: SQL (Quick)**
```bash
npm run prisma studio
# Click "Division" table and add rows manually with name, district, latitude, longitude
```

**Option B: Direct SQL**
```sql
INSERT INTO "Division" (name, district, latitude, longitude) VALUES
  ('Colombo', 'Western', 6.9271, 80.6369),
  ('Galle', 'Southern', 6.0367, 80.2226);
```

**Option C: Prisma Client**
```typescript
await prisma.division.create({
  data: { name: 'Colombo', district: 'Western', latitude: 6.9271, longitude: 80.6369 }
});
```

- [ ] At least one division with valid lat/long added
- [ ] Can verify via: `npm run prisma studio`

### 3. Initialize Weather Scheduler

Open `app/layout.tsx` and add this to the root layout:

```typescript
import { initializeWeatherSystem } from "@/lib/weather-init";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Initialize weather system on app startup (server-side only)
  if (typeof window === "undefined") {
    await initializeWeatherSystem();
  }

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] Added initialization code to `app/layout.tsx`
- [ ] Code is in server-side only (inside `if (typeof window === "undefined")`)

### 4. Environment Variables (Optional)

Add to `.env.local` for customization:

```env
# Optional: Set fetch time (default: 02:00 UTC)
WEATHER_FETCH_TIME=02:00

# Optional: Enable/disable (default: true)
WEATHER_ENABLED=true
```

- [ ] `.env.local` updated with desired settings (or skip for defaults)

---

## Testing

### 5. Start Development Server

```bash
npm run dev
```

- [ ] Server starts without errors
- [ ] No errors in console related to weather initialization

### 6. Verify System is Running

Test the weather API endpoint:

```bash
curl http://localhost:3000/api/weather
```

Expected response:
```json
{
  "success": true,
  "message": "Weather data system is operational",
  "endpoints": { ... }
}
```

- [ ] API returns success response
- [ ] System endpoints are visible

### 7. Manual Test: Fetch Data

Trigger manual fetch to test everything works:

```bash
curl -X POST http://localhost:3000/api/weather/fetch
```

Expected response:
```json
{
  "success": true,
  "message": "Weather data fetch completed",
  "data": { "success": 1, "failed": 0, "errors": [] }
}
```

- [ ] Manual fetch succeeds
- [ ] All divisions processed successfully (or check for expected errors)

### 8. Check Data in Database

Verify data was saved to database:

```bash
npm run prisma studio
# Navigate to RainfallData, SoilMoisture, TemperatureData tables
# Should see entries for today's date
```

- [ ] `RainfallData` table has entries
- [ ] `SoilMoisture` table has entries
- [ ] `TemperatureData` table has entries
- [ ] Dates match today

### 9. Start Scheduler

```bash
curl -X POST http://localhost:3000/api/weather/scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "scheduleTime": "02:00", "runNow": false}'
```

- [ ] Scheduler starts successfully
- [ ] Returns `"active": true` in response

### 10. Verify Scheduler Status

```bash
curl http://localhost:3000/api/weather/scheduler
```

Expected: `"active": true`, with scheduled time

- [ ] Scheduler shows as active
- [ ] Schedule time is correct (02:00 by default)

---

## ✅ System is Live!

Your weather integration is now running. The system will:

- 📅 **Daily at 2 AM UTC** (or your configured time) automatically fetch weather data
- 🌧️ **Rainfall data** - Daily rain sum in mm
- 🌡️ **Temperature data** - Daily apparent temperature in °C
- 💧 **Soil moisture** - Daily averages aggregated from hourly OpenMeteO readings

Data is automatically saved to:
- `RainfallData` table
- `SoilMoisture` table
- `TemperatureData` table

---

## Common Commands

### Manual Fetch (Anytime)
```bash
curl -X POST http://localhost:3000/api/weather/fetch
```

### Fetch Historical Data
```bash
curl -X POST http://localhost:3000/api/weather/fetch \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-01-15"}'
```

### Stop Scheduler
```bash
curl -X POST http://localhost:3000/api/weather/scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "stop"}'
```

### Restart Scheduler (New Time)
```bash
curl -X POST http://localhost:3000/api/weather/scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "restart", "scheduleTime": "03:30"}'
```

---

## Troubleshooting

**Problem**: No data appearing in database

**Solution**:
1. Check divisions table: `npm run prisma studio` → verify lat/long populated
2. Test API manually: `curl -X POST http://localhost:3000/api/weather/fetch`
3. Check console logs for errors
4. Verify database connection: `DATABASE_URL` in `.env.local`

**Problem**: Scheduler not running

**Solution**:
1. Check status: `curl http://localhost:3000/api/weather/scheduler`
2. Ensure dev server is running: `npm run dev`
3. Try restarting scheduler: See "Restart Scheduler" command above

**Problem**: Soil moisture values look wrong

**Solution**:
1. Review mapping function in `lib/openmeteo.ts`
2. Compare OpenMeteO raw data with database values
3. Customize mapping based on local soil science

---

## Documentation

Full documentation available in:
- `docs/WEATHER_DATA_INTEGRATION.md` - Complete technical guide
- `WEATHER_SETUP_GUIDE.md` - Detailed setup instructions
- `lib/weather-scheduler.ts` - Code comments with examples

---

## Files Created

- ✅ `lib/openmeteo.ts` - API integration & aggregation
- ✅ `lib/weather-db.ts` - Database operations
- ✅ `lib/weather-scheduler.ts` - Scheduling engine
- ✅ `lib/weather-init.ts` - App initialization
- ✅ `app/api/weather/route.ts` - System status
- ✅ `app/api/weather/fetch/route.ts` - Manual fetch
- ✅ `app/api/weather/scheduler/route.ts` - Scheduler management
- ✅ `docs/WEATHER_DATA_INTEGRATION.md` - Full documentation
- ✅ `WEATHER_SETUP_GUIDE.md` - Setup guide
- ✅ `scripts/setup-weather.sh` - Setup helper
- ✅ `prisma/schema.prisma` - Updated with weather models

---

## Support

- **OpenMeteO API Docs**: https://open-meteo.com/en/docs
- **Prisma Docs**: https://www.prisma.io/docs/
- **Next.js Docs**: https://nextjs.org/docs/

---

**Last Updated**: January 2024
**Status**: ✅ Ready to Use
