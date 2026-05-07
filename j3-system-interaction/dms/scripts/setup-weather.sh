#!/bin/bash
# Weather Integration Setup Helper Script
# Run this script to help set up the weather data integration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=========================================="
echo "Weather Data Integration Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}Error: package.json not found. Please run this from the dms directory.${NC}"
  exit 1
fi

echo "✓ Found project directory"
echo ""

# Step 1: Check dependencies
echo "Step 1: Checking dependencies..."
if ! grep -q "@prisma/client" package.json; then
  echo -e "${YELLOW}⚠ @prisma/client not found in package.json${NC}"
  echo "Run: npm install @prisma/client prisma"
else
  echo "✓ Prisma dependencies found"
fi
echo ""

# Step 2: Prisma setup
echo "Step 2: Prisma Setup"
echo "Generated Prisma client? (y/n)"
read -r prisma_gen

if [ "$prisma_gen" = "y" ]; then
  echo "Run: npm run prisma generate"
else
  echo -e "${YELLOW}Skipping Prisma client generation${NC}"
fi
echo ""

# Step 3: Database migrations
echo "Step 3: Database Migrations"
echo "Have you applied the migrations? (y/n)"
read -r migration_done

if [ "$migration_done" != "y" ]; then
  echo -e "${YELLOW}⚠ You need to run database migrations:${NC}"
  echo "  npm run prisma migrate dev --name 'add_weather_data_models'"
  echo "  OR"
  echo "  npm run prisma db push"
fi
echo ""

# Step 4: Environment variables
echo "Step 4: Environment Variables"
if grep -q "DATABASE_URL" .env.local 2>/dev/null; then
  echo "✓ DATABASE_URL found in .env.local"
else
  echo -e "${RED}✗ DATABASE_URL not found in .env.local${NC}"
  echo "Please add to .env.local:"
  echo "  DATABASE_URL=postgresql://j3user:j3password@localhost:5432/j3db"
fi

# Check for optional weather variables
if grep -q "WEATHER_FETCH_TIME" .env.local 2>/dev/null; then
  FETCH_TIME=$(grep "WEATHER_FETCH_TIME" .env.local | cut -d'=' -f2)
  echo "✓ WEATHER_FETCH_TIME set to: $FETCH_TIME"
else
  echo -e "${YELLOW}⚠ WEATHER_FETCH_TIME not set (defaults to 02:00 UTC)${NC}"
fi
echo ""

# Step 5: Database population
echo "Step 5: Database Population"
echo "Have you populated the Division table with lat/long? (y/n)"
read -r division_populate

if [ "$division_populate" != "y" ]; then
  echo -e "${YELLOW}⚠ You need to add divisions to the database:${NC}"
  echo "Option A - Via SQL:"
  echo "  INSERT INTO \"Division\" (name, district, latitude, longitude) VALUES"
  echo "    ('Colombo', 'Western', 6.9271, 80.6369),"
  echo "    ('Galle', 'Southern', 6.0367, 80.2226);"
  echo ""
  echo "Option B - Via Prisma Studio:"
  echo "  npm run prisma studio"
fi
echo ""

# Step 6: Verify files
echo "Step 6: Verifying Implementation Files"
FILES=(
  "lib/openmeteo.ts"
  "lib/weather-db.ts"
  "lib/weather-scheduler.ts"
  "lib/weather-init.ts"
  "app/api/weather/route.ts"
  "app/api/weather/fetch/route.ts"
  "app/api/weather/scheduler/route.ts"
  "docs/WEATHER_DATA_INTEGRATION.md"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file"
  else
    echo -e "${RED}✗ $file (MISSING)${NC}"
  fi
done
echo ""

# Step 7: API Testing
echo "Step 7: API Endpoints"
echo "Once the app is running, test these endpoints:"
echo ""
echo "Check weather system status:"
echo "  curl http://localhost:3000/api/weather"
echo ""
echo "Manual fetch:"
echo "  curl -X POST http://localhost:3000/api/weather/fetch"
echo ""
echo "Start scheduler (2 AM UTC):"
echo "  curl -X POST http://localhost:3000/api/weather/scheduler -H 'Content-Type: application/json' -d '{\"action\": \"start\", \"scheduleTime\": \"02:00\"}'"
echo ""
echo "Check scheduler status:"
echo "  curl http://localhost:3000/api/weather/scheduler"
echo ""

echo "=========================================="
echo "Setup Summary"
echo "=========================================="
echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo "1. ✓ Prisma schema updated with weather models"
echo "2. ✓ Implementation files created"
echo "3. ⏳ Run: npm run prisma generate"
echo "4. ⏳ Run: npm run prisma migrate dev"
echo "5. ⏳ Populate Division table with coordinates"
echo "6. ⏳ Add initialization call to app/layout.tsx"
echo "7. ⏳ Start development server"
echo "8. ⏳ Test API endpoints"
echo ""
echo "For detailed documentation, see: docs/WEATHER_DATA_INTEGRATION.md"
echo ""
