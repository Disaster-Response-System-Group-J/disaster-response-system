#!/bin/bash
# Quick Seed All Divisions
# Run this to automatically seed 100+ locations in one command

set -e

if [ ! -f "package.json" ]; then
  echo "Error: package.json not found. Run from dms directory."
  exit 1
fi

echo "============================================"
echo "Disaster Response System - Quick Division Seed"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check dependencies
echo "Checking dependencies..."
if ! command -v npm &> /dev/null; then
  echo "Error: npm not found"
  exit 1
fi

if ! command -v node &> /dev/null; then
  echo "Error: node not found"
  exit 1
fi

echo -e "${GREEN}✓${NC} npm and node found"
echo ""

# Check if Prisma is installed
if ! npm list @prisma/client &>/dev/null; then
  echo -e "${YELLOW}⚠ Installing Prisma dependencies...${NC}"
  npm install @prisma/client prisma ts-node
fi

echo ""
echo "Step 1: Generating Prisma Client..."
npm run prisma:generate

echo ""
echo "Step 2: Applying Database Migrations..."
echo -e "${YELLOW}Note: If migrations fail, run: ${BLUE}npm run prisma:migrate${NC}"
npm run prisma:push || echo "⚠ Migration warning - proceeding anyway"

echo ""
echo "Step 3: Seeding Divisions..."
echo -e "${BLUE}This will seed 100+ Sri Lankan locations...${NC}"
echo ""

npm run prisma:seed

echo ""
echo "============================================"
echo -e "${GREEN}✓ Division seeding complete!${NC}"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Run: npm run dev"
echo "2. Test: curl http://localhost:3000/api/divisions/seed"
echo "3. View: npm run prisma:studio"
echo ""
echo "To fetch weather data for all divisions:"
echo "1. curl -X POST http://localhost:3000/api/weather/fetch"
echo ""
