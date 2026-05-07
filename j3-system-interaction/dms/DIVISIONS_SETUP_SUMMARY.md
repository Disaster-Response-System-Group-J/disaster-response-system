# Division Locations - Setup Complete ✅

All 100+ Sri Lankan division locations are now ready to be seeded into your database.

## What Was Set Up

### 1. **Schema Updates** 
- Added `province` field to Division table
- Added `locationId` field for location reference
- Added `createdAt`, `updatedAt` timestamps

### 2. **Location Data**
- **100+ divisions** from all 9 provinces of Sri Lanka
- **GPS coordinates** for each location (latitude/longitude)
- **Province and district** information
- File: `lib/locations.ts`

### 3. **Seeding Methods** (Choose One)

#### ⚡ Method A: API (Fastest - No Terminal Commands)
```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Seed via API
curl -X POST http://localhost:3000/api/divisions/seed \
  -H "Content-Type: application/json" \
  -d '{"action": "seed"}'
```

#### 📦 Method B: Prisma Seed (Recommended)
```bash
npm run prisma:seed
```

#### 🚀 Method C: Quick Shell Script
```bash
bash scripts/quick-seed.sh
# (Runs migration + seeding + verification all at once)
```

#### 🎨 Method D: Prisma Studio (Interactive)
```bash
npm run prisma:studio
# Manually add records in web UI
```

### 4. **API Endpoints**

#### `POST /api/divisions/seed` - Seed/Clear
```bash
# Seed 100+ divisions
curl -X POST http://localhost:3000/api/divisions/seed \
  -d '{"action": "seed"}'

# Clear all divisions
curl -X POST http://localhost:3000/api/divisions/seed \
  -d '{"action": "clear"}'
```

#### `GET /api/divisions/seed` - Check Status
```bash
curl http://localhost:3000/api/divisions/seed
```

#### `GET /api/divisions` - List Divisions
```bash
# Get all (paginated)
curl http://localhost:3000/api/divisions

# Filter by province
curl "http://localhost:3000/api/divisions?province=Central"

# Filter by district
curl "http://localhost:3000/api/divisions?district=Kandy"

# Pagination
curl "http://localhost:3000/api/divisions?page=2&limit=25"
```

### 5. **Files Created/Updated**

**New Files:**
- ✅ `lib/locations.ts` - All 100+ locations data
- ✅ `prisma/seed.ts` - Prisma seed script
- ✅ `app/api/divisions/seed/route.ts` - Seed API endpoint
- ✅ `app/api/divisions/route.ts` - List API endpoint
- ✅ `scripts/quick-seed.sh` - One-command setup
- ✅ `prisma/divisions_insert.sql` - SQL reference
- ✅ `DIVISIONS_SEED_GUIDE.md` - Complete documentation

**Updated Files:**
- ✅ `prisma/schema.prisma` - Division model updated with province
- ✅ `package.json` - Added prisma scripts and ts-node

---

## Quick Start (30 seconds)

```bash
cd j3-system-interaction/dms

# Step 1: Generate Prisma client
npm run prisma:generate

# Step 2: Apply migrations
npm run prisma:migrate

# Step 3: Start server
npm run dev

# Step 4 (new terminal): Seed divisions
curl -X POST http://localhost:3000/api/divisions/seed

# Step 5: Verify
npm run prisma:studio
# Check Division table - should have 100+ entries
```

---

## Data Breakdown

### By Province (100+ Total Locations)
- **Central Province**: 30 divisions (Kandy, Matale, Nuwara Eliya)
- **Uva Province**: 12 divisions (Badulla, Monaragala, Welimada)
- **North Central Province**: 18 divisions (Anuradhapura, Polonnaruwa)
- **Northern Province**: 10 divisions (Jaffna, Mannar, Vavuniya, Kilinochchi, Mullaitivu)
- **Eastern Province**: 10 divisions (Trincomalee, Batticaloa, Ampara)
- **Sabaragamuwa Province**: 8 divisions (Kegalle, Ratnapura)
- **North Western Province**: 10 divisions (Kurunegala, Puttalam)
- **Western Province**: 1 division (Gampaha)
- **Southern Province**: 1 division (Hambantota)

### Sample Locations
```
✓ Ududumbara (Kandy, Central) - 7.30°N, 80.83°E
✓ Matale (Matale, Central) - 7.47°N, 80.62°E
✓ Nuwara Eliya (Nuwara Eliya, Central) - 6.95°N, 80.79°E
✓ Jaffna (Jaffna, Northern) - 9.83°N, 80.25°E
✓ Trincomalee (Trincomalee, Eastern) - 8.57°N, 81.25°E
✓ Badulla (Badulla, Uva) - 6.99°N, 81.06°E
... (100+ total)
```

---

## Integration with Weather System

Once divisions are seeded, the weather system automatically:

1. ✅ Fetches daily weather for ALL 100+ locations
2. ✅ Uses GPS coordinates to query OpenMeteO API
3. ✅ Stores rainfall, temperature, soil moisture
4. ✅ Aggregates hourly soil moisture to daily averages

**Test the full integration:**
```bash
# 1. Seed divisions
curl -X POST http://localhost:3000/api/divisions/seed

# 2. Manual weather fetch
curl -X POST http://localhost:3000/api/weather/fetch

# 3. View results in Prisma Studio
npm run prisma:studio
# Check: RainfallData, TemperatureData, SoilMoisture tables
# Should have ~100 entries each for today
```

---

## Common Commands

```bash
# View all divisions
curl http://localhost:3000/api/divisions

# Get divisions in Central province only
curl "http://localhost:3000/api/divisions?province=Central"

# Count check
npm run prisma:studio
# Query: SELECT COUNT(*) FROM "Division";

# Clear and start fresh
curl -X POST http://localhost:3000/api/divisions/seed -d '{"action": "clear"}'

# Reseed
curl -X POST http://localhost:3000/api/divisions/seed -d '{"action": "seed"}'
```

---

## Validation Checklist

- [ ] Database schema updated
- [ ] Prisma client generated: `npm run prisma:generate`
- [ ] Migrations applied: `npm run prisma:migrate`
- [ ] Divisions seeded (100+ records)
- [ ] Verify in Prisma Studio: `npm run prisma:studio`
- [ ] All divisions have valid coordinates (no NULLs)
- [ ] Provider field populated for all entries
- [ ] Weather system ready to fetch data

---

## Next Steps

### 1. Verify Seeding Success
```bash
# Check status
curl http://localhost:3000/api/divisions/seed

# Should show: "totalInDatabase": 100 (or more)
```

### 2. Test Weather Collection
```bash
# Fetch weather for all divisions
curl -X POST http://localhost:3000/api/weather/fetch

# Monitor logs for:
# "[Weather Fetch] Processing division: Ududumbara..."
# "[Weather Fetch] Saved weather data for Ududumbara on 2024-01-15"
```

### 3. Start Automated Daily Runs
```bash
# Start scheduler
curl -X POST http://localhost:3000/api/weather/scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "scheduleTime": "02:00"}'

# Verify running
curl http://localhost:3000/api/weather/scheduler
```

### 4. Monitor Data Quality
```bash
# Query database
npm run prisma:studio

# Check tables:
# - Division (100+ entries with province and coordinates)
# - RainfallData (entries for all divisions)
# - TemperatureData (entries for all divisions)
# - SoilMoisture (entries for all divisions)
```

---

## Troubleshooting

**"Not getting 100 divisions?"**
- Check if seed ran without errors: `curl http://localhost:3000/api/divisions/seed`
- Error details included if any failed
- Try clearing and reseeding: `curl -X POST http://localhost:3000/api/divisions/seed -d '{"action": "clear"}'`

**"Coordinates seem wrong?"**
- All Sri Lankan divisions should be: 6-10°N latitude, 79-82°E longitude
- Verify sample: `npm run prisma:studio` → Division table

**"Weather not fetching?"**
- Ensure divisions have coordinates: Check Prisma Studio
- Test manual fetch: `curl -X POST http://localhost:3000/api/weather/fetch`
- Check console logs for error messages

---

## Documentation

- **Full Guide**: `DIVISIONS_SEED_GUIDE.md`
- **Weather Docs**: `WEATHER_DATA_INTEGRATION.md`
- **Locations Data**: `lib/locations.ts`
- **Seed Script**: `prisma/seed.ts`

---

## Summary

✅ **100+ Sri Lankan divisions** are now stored with:
- Province and district information
- GPS coordinates for weather API
- Ready for automated daily weather collection
- Integrated with disaster response system

**Start seeding now:** 
```bash
npm run dev
# Then in another terminal:
curl -X POST http://localhost:3000/api/divisions/seed
```

🎉 **All 100+ divisions + weather system ready to go!**
