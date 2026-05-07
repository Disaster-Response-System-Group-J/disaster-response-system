/**
 * Seed Database with Division Locations
 * Run with: npx ts-node scripts/seed-locations.ts
 * Or: npm run prisma db seed
 */

import { PrismaClient } from "@prisma/client";
import { DS_LOCATIONS } from "../lib/locations";

const prisma = new PrismaClient();

async function seedLocations() {
  try {
    console.log(`[Seed] Starting to seed ${DS_LOCATIONS.length} divisions...`);

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const location of DS_LOCATIONS) {
      try {
        const division = await prisma.division.upsert({
          where: { name: location.name },
          update: {
            name: location.name,
            district: location.district,
            province: location.province,
            latitude: location.lat,
            longitude: location.lon,
          },
          create: {
            name: location.name,
            district: location.district,
            province: location.province,
            latitude: location.lat,
            longitude: location.lon,
          },
        });

        // Check if was created or updated
        const isNew = division.createdAt === division.updatedAt;
        if (isNew) {
          created++;
        } else {
          updated++;
        }

        console.log(
          `✓ ${location.name} (ID: ${location.id}) (${location.district}, ${location.province}) - ${location.lat}, ${location.lon}`
        );
      } catch (error) {
        errors++;
        console.error(`✗ Failed to seed ${location.name}:`, error);
      }
    }

    console.log(`\n[Seed] Complete!`);
    console.log(`  Created: ${created}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Total: ${DS_LOCATIONS.length}`);

    // Verify all records
    const totalDivisions = await prisma.division.count();
    console.log(`\n[Seed] Total divisions in database: ${totalDivisions}`);

    // Show summary by province
    const byProvince = await prisma.division.groupBy({
      by: ["province"],
      _count: {
        divisionId: true,
      },
      orderBy: {
        province: "asc",
      },
    });

    console.log(`\n[Seed] Divisions by Province:`);
    for (const group of byProvince) {
      console.log(`  ${group.province}: ${group._count.divisionId}`);
    }
  } catch (error) {
    console.error("[Seed] Fatal error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedLocations();
