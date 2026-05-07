/**
 * Script: Update Division Population from CSV
 * Matches divisions by name and updates population field
 * 
 * Run with: npx ts-node scripts/update-division-population.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as csv from "csv-parser";

const prisma = new PrismaClient();

// Read CSV file and parse it
function readPopulationCSV(filePath: string): Promise<Map<string, number>> {
  return new Promise((resolve, reject) => {
    const populationMap = new Map<string, number>();

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row: any) => {
        const divisionName = row.division?.trim();
        const population = parseInt(row.population, 10);

        if (divisionName && !isNaN(population)) {
          populationMap.set(divisionName, population);
        }
      })
      .on("end", () => {
        resolve(populationMap);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

async function updatePopulations() {
  try {
    // Path to the CSV file
    const csvPath = path.join(
      __dirname,
      "../../j2-data-intelligence/Model Training and Validation/division_population_map.csv"
    );

    console.log(`[Population Update] Reading CSV from: ${csvPath}`);

    // Check if file exists
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found: ${csvPath}`);
    }

    // Read population data from CSV
    const populationMap = await readPopulationCSV(csvPath);
    console.log(`[Population Update] Loaded ${populationMap.size} divisions from CSV`);

    // Get all divisions from database
    const allDivisions = await prisma.division.findMany({
      select: {
        divisionId: true,
        name: true,
      },
    });

    console.log(`[Population Update] Found ${allDivisions.length} divisions in database`);

    let updated = 0;
    let failed = 0;
    const skipped = 0;
    const failedDivisions: string[] = [];

    // Update each division with population data
    for (const division of allDivisions) {
      const population = populationMap.get(division.name);

      if (!population) {
        console.warn(`⚠ No population data found for: ${division.name}`);
        failedDivisions.push(division.name);
        failed++;
        continue;
      }

      try {
        await prisma.division.update({
          where: { divisionId: division.divisionId },
          data: {
            divisionPopulation: population,
          },
        });

        console.log(`✓ Updated ${division.name}: ${population} population`);
        updated++;
      } catch (error) {
        console.error(`✗ Failed to update ${division.name}:`, error);
        failedDivisions.push(division.name);
        failed++;
      }
    }

    console.log(`\n[Population Update] Complete!`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Skipped: ${skipped}`);

    if (failedDivisions.length > 0) {
      console.log(`\n[Population Update] Failed to update divisions:`);
      failedDivisions.forEach((name) => console.log(`  - ${name}`));
    }

    // Verify updates
    const populatedDivisions = await prisma.division.count({
      where: {
        divisionPopulation: {
          not: null,
        },
      },
    });

    console.log(`\n[Population Update] Divisions with population data: ${populatedDivisions}/${allDivisions.length}`);
  } catch (error) {
    console.error("[Population Update] Error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
updatePopulations()
  .then(() => {
    console.log("[Population Update] Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[Population Update] Script failed:", error);
    process.exit(1);
  });
