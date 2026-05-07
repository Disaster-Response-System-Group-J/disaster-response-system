# Population Division Locations Data

Complete guide to populate the Division table with all 100+ Sri Lankan locations.

## Overview

All 100+ division locations with coordinates (latitude/longitude) and province information have been added to the system. The locations cover:
- 9 provinces: Central, North Central, Northern, Eastern, Uva, Sabaragamuwa, Western, Southern, North Western
- Multiple districts across the country
- Precise GPS coordinates for weather data fetching

## Table Schema Updates

The `Division` table has been updated to include:

```sql
CREATE TABLE "Division" (
  division_id          SERIAL PRIMARY KEY,
  location_id          VARCHAR UNIQUE,      -- Original location ID
  name                 VARCHAR UNIQUE,      -- Location name (e.g., "Ududumbara")
  district             VARCHAR,              -- District name
  province             VARCHAR,              -- Province name
  latitude             NUMERIC,              -- For OpenMeteO API
  longitude            NUMERIC,              -- For OpenMeteO API
  created_at           TIMESTAMP,
  updated_at           TIMESTAMP
);
```

## Setup Methods

Choose ONE method to populate the divisions:

### Method 1: Via API (Recommended - Easiest)

**Fastest and requires no terminal commands:**

```bash
# 1. Start your development server
npm run dev

# 2. In another terminal, seed the divisions
curl -X POST http://localhost:3000/api/divisions/seed \
  -H "Content-Type: application/json" \
  -d '{"action": "seed"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Divisions seeding completed",
  "data": {
    "processedCount": 100,
    "createdCount": 100,
    "updatedCount": 0,
    "errorCount": 0,
    "totalInDatabase": 100
  }
}
```

**Check status anytime:**
```bash
curl http://localhost:3000/api/divisions/seed
```

---

### Method 2: Via Prisma Seed (Recommended for Production)

**Using Prisma's built-in seed system:**

```bash
cd j3-system-interaction/dms

# Run the seed script
npm run prisma:seed
# OR
npx prisma db seed
```

**Output:**
```
[Seed] Starting to seed 100 divisions...
✓ Ududumbara (Kandy, Central) - 7.3, 80.8333
✓ Laggala (Matale, Central) - 7.6, 80.75
...
[Seed] Complete!
  Created: 100
  Updated: 0
  Errors: 0
  Total: 100

[Seed] Total divisions in database: 100

[Seed] Divisions by Province:
  Central: 30
  Uva: 12
  North Central: 18
  Northern: 10
  Eastern: 10
  Sabaragamuwa: 8
  Southern: 1
  Western: 1
  North Western: 10
```

---

### Method 3: Via Prisma Studio (Interactive)

**For manual review and editing:**

```bash
npm run prisma:studio
```

1. Opens Prisma Studio in browser
2. Click on "Division" table
3. Click "Add record" button
4. Manually enter location details (DO THIS FOR ONLY ONE OR TWO - tedious!)
5. Or import data via CSV

---

### Method 4: Via Direct SQL

**If you prefer raw SQL:**

```bash
psql -U j3user -d j3db
```

Then run the SQL inserts manually (see `locations_insert.sql` example below).

---

## Quick Start Steps

### Step 1: Ensure Database is Ready

```bash
# Generate Prisma client
npm run prisma:generate

# Apply schema migrations
npm run prisma:migrate
# When prompted: name it "add_province_to_division" or similar
```

### Step 2: Seed the Data

Choose your preferred method above. **Method 1 (API) is fastest:**

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Seed divisions
curl -X POST http://localhost:3000/api/divisions/seed \
  -H "Content-Type: application/json" \
  -d '{"action": "seed"}'
```

### Step 3: Verify the Data

Check Prisma Studio:

```bash
npm run prisma:studio
```

Or query via API:
```bash
curl http://localhost:3000/api/divisions/seed
```

Or count in database:
```bash
psql -U j3user -d j3db -c "SELECT COUNT(*) FROM \"Division\";"
```

---

## Data Breakdown

### Divisions by Province

| Province | Count | Districts |
|----------|-------|-----------|
| **Central** | 30 | Kandy, Matale, Nuwara Eliya |
| **Uva** | 12 | Badulla, Monaragala, Welimada |
| **North Central** | 18 | Anuradhapura, Polonnaruwa |
| **Northern** | 10 | Jaffna, Mannar, Vavuniya, Kilinochchi, Mullaitivu |
| **Eastern** | 10 | Trincomalee, Batticaloa, Ampara |
| **Sabaragamuwa** | 8 | Kegalle, Ratnapura |
| **North Western** | 10 | Kurunegala, Puttalam |
| **Western** | 1 | Gampaha |
| **Southern** | 1 | Hambantota |
| **TOTAL** | **100** | Multiple |

### Sample Locations

```typescript
// Central Province
{ id: "Ududumbara", district: "Kandy", province: "Central", lat: 7.3000, lon: 80.8333 },
{ id: "Matale", district: "Matale", province: "Central", lat: 7.4675, lon: 80.6235 },
{ id: "Nuwara Eliya", district: "Nuwara Eliya", province: "Central", lat: 6.9497, lon: 80.7891 },

// Northern Province
{ id: "Jaffna Town", district: "Jaffna", province: "Northern", lat: 9.8333, lon: 80.2500 },
{ id: "Mannar Town", district: "Mannar", province: "Northern", lat: 8.9760, lon: 79.9047 },

// Eastern Province
{ id: "Trincomalee", district: "Trincomalee", province: "Eastern", lat: 8.5667, lon: 81.2500 },
{ id: "Batticaloa", district: "Batticaloa", province: "Eastern", lat: 7.7167, lon: 81.8167 },
```

---

## Files Involved

### New/Updated Files

1. **`lib/locations.ts`** - All 100+ locations data
   - Exported as `DS_LOCATIONS`
   - Type: `DivisionLocation`

2. **`prisma/seed.ts`** - Prisma seed script
   - Upserts all divisions with full details
   - Generates summary report by province
   - Handles errors gracefully

3. **`app/api/divisions/seed/route.ts`** - API endpoint
   - `POST /api/divisions/seed` - Seed or clear
   - `GET /api/divisions/seed` - Check status

4. **`package.json`** - Updated scripts
   - Added prisma commands
   - Added seed configuration

5. **`prisma/schema.prisma`** - Updated schema
   - Added `locationId` field
   - Added `province` field
   - Added timestamps (`createdAt`, `updatedAt`)

---

## API Reference

### GET /api/divisions/seed

Get seeding status and summary.

**Response:**
```json
{
  "success": true,
  "message": "Divisions seed status",
  "summary": {
    "totalExpected": 100,
    "totalInDatabase": 100,
    "byProvince": [
      { "province": "Central", "count": 30 },
      { "province": "Eastern", "count": 10 },
      // ...
    ]
  }
}
```

### POST /api/divisions/seed

Seed divisions or clear them.

**Action: seed** (default)
```bash
curl -X POST http://localhost:3000/api/divisions/seed \
  -H "Content-Type: application/json" \
  -d '{"action": "seed"}'
```

Response with creation stats and error details if any.

**Action: clear** (CAUTION!)
```bash
curl -X POST http://localhost:3000/api/divisions/seed \
  -H "Content-Type: application/json" \
  -d '{"action": "clear"}'
```

Deletes all divisions from database.

---

## Weather Integration

Once divisions are seeded with coordinates, the weather system will automatically:

1. ✅ Fetch daily data for ALL 100+ locations
2. ✅ Get rainfall, temperature, soil moisture from OpenMeteO
3. ✅ Store to `RainfallData`, `TemperatureData`, `SoilMoisture` tables
4. ✅ Keyed by `division_id` for easy linking

**Example workflow:**
```bash
# 1. Seed divisions
curl -X POST http://localhost:3000/api/divisions/seed

# 2. Verify weather system is ready
curl http://localhost:3000/api/weather

# 3. Manual fetch to test
curl -X POST http://localhost:3000/api/weather/fetch

# 4. View data in Prisma Studio
npm run prisma:studio
# Check RainfallData table - should have 100 entries for today
```

---

## Troubleshooting

### Issue: "Division name must be unique" error

**Cause:** Duplicate names in the data

**Solution:**
```bash
# Clear and reseed
curl -X POST http://localhost:3000/api/divisions/seed \
  -H "Content-Type: application/json" \
  -d '{"action": "clear"}'

# Then seed again
curl -X POST http://localhost:3000/api/divisions/seed \
  -H "Content-Type: application/json" \
  -d '{"action": "seed"}'
```

### Issue: Seeding is slow

**Normal behavior** - 100+ records with database inserts takes ~5-10 seconds

If it takes longer, check:
- Database connection is fast
- No other heavy queries running
- Server isn't out of memory

### Issue: Some locations appear twice

**Cause:** Ran seed twice without clearing

**Solution:**
```bash
# Option 1: Clear and reseed
curl -X POST http://localhost:3000/api/divisions/seed -d '{"action": "clear"}'

# Option 2: Manual cleanup
npm run prisma:studio
# Delete duplicate entries manually
```

### Issue: Coordinates look wrong (negative or out of range)

**All locations should be:**
- Latitude: 6.0° - 10.0° N
- Longitude: 79.0° - 82.0° E

If you see otherwise:
- Check the API response for data corruption
- Verify using `npm run prisma:studio` and check a few records
- Report data issues with location name and coordinates

---

## After Seeding: What's Next?

### 1. Verify Data Quality
```bash
# Check all provinces are present
npm run prisma:studio
# Browse Division table

# Or via SQL
SELECT DISTINCT province FROM "Division" ORDER BY province;
```

### 2. Start Weather Collection
```bash
# Initialize weather scheduler
curl -X POST http://localhost:3000/api/weather/scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "scheduleTime": "02:00"}'

# Verify it's running
curl http://localhost:3000/api/weather/scheduler
```

### 3. Manual Test Run
```bash
# Fetch weather for all 100 locations
curl -X POST http://localhost:3000/api/weather/fetch

# Check results
npm run prisma:studio
# View RainfallData, SoilMoisture, TemperatureData tables
```

---

## SQL Reference

### Count divisions by province

```sql
SELECT province, COUNT(*) as count
FROM "Division"
GROUP BY province
ORDER BY count DESC;
```

### Find all divisions in a specific province

```sql
SELECT name, district, latitude, longitude
FROM "Division"
WHERE province = 'Central'
ORDER BY district, name;
```

### Verify all locations have coordinates

```sql
SELECT COUNT(*) as missing_coords
FROM "Division"
WHERE latitude IS NULL OR longitude IS NULL;
```

### Sample divisions with their related weather data

```sql
SELECT d.name, d.district, d.latitude, d.longitude,
       r.date as rain_date, r.rain_sum,
       t.temperature, s.moisture_7_28cm
FROM "Division" d
LEFT JOIN "RainfallData" r ON d.division_id = r.division_id
LEFT JOIN "TemperatureData" t ON d.division_id = t.division_id
LEFT JOIN "SoilMoisture" s ON d.division_id = s.division_id
LIMIT 10;
```

---

## Complete Setup Checklist

- [ ] Schema updated: `prisma/schema.prisma`
- [ ] Migration running: `npm run prisma:generate`
- [ ] Database migrated: `npm run prisma:migrate`
- [ ] Divisions seeded (choose one method):
  - [ ] API method: `curl -X POST http://localhost:3000/api/divisions/seed`
  - [ ] Prisma seed: `npm run prisma:seed`
  - [ ] Manual via Prisma Studio
- [ ] Verify count: `curl http://localhost:3000/api/divisions/seed`
- [ ] Weather system configured and running
- [ ] First weather fetch tested manually
- [ ] Scheduler started for daily runs

---

## Support

- **Locations Data**: `lib/locations.ts`
- **Seed Script**: `prisma/seed.ts`
- **Seed API**: `app/api/divisions/seed/route.ts`
- **Weather Integration**: `docs/WEATHER_DATA_INTEGRATION.md`

---

**All 100+ divisions are now ready for weather data collection!**
