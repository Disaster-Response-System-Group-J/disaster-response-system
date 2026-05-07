/**
 * API Route: Populate Divisions from Locations
 * POST /api/divisions/seed - Seed divisions from DS_LOCATIONS
 * GET /api/divisions/seed - Get seed status
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { DS_LOCATIONS } from "@/lib/locations";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const totalDivisions = await prisma.division.count();

    const byProvince = await prisma.division.groupBy({
      by: ["province"],
      _count: {
        divisionId: true,
      },
      orderBy: {
        province: "asc",
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Divisions seed status",
        summary: {
          totalExpected: DS_LOCATIONS.length,
          totalInDatabase: totalDivisions,
          byProvince: byProvince.map((group) => ({
            province: group.province,
            count: group._count.divisionId,
          })),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Divisions Seed API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || request.nextUrl.searchParams.get("action") || "seed";

    if (action === "seed") {
      console.log(`[Divisions Seed API] Starting to seed ${DS_LOCATIONS.length} divisions...`);

      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const location of DS_LOCATIONS) {
        try {
          const result = await prisma.division.upsert({
            where: { name: location.name },
            update: {
              locationId: location.id,
              district: location.district,
              province: location.province,
              latitude: location.lat,
              longitude: location.lon,
            },
            create: {
              name: location.name,
              locationId: location.id,
              district: location.district,
              province: location.province,
              latitude: location.lat,
              longitude: location.lon,
            },
          });

          // Check if record was updated or created by comparing timestamps
          // Note: Prisma doesn't return this info, so we count everything as processed
          if (result.createdAt === result.updatedAt) {
            created++;
          } else {
            updated++;
          }
        } catch (error) {
          const errorMsg = `Failed to seed ${location.id}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      const totalDivisions = await prisma.division.count();

      return NextResponse.json(
        {
          success: errors.length === 0,
          message: "Divisions seeding completed",
          data: {
            processedCount: DS_LOCATIONS.length,
            createdCount: created,
            updatedCount: updated,
            errorCount: errors.length,
            totalInDatabase: totalDivisions,
            errors: errors.length > 0 ? errors : undefined,
          },
        },
        { status: errors.length === 0 ? 200 : 207 }
      );
    } else if (action === "clear") {
      // Optional: Clear all divisions (use with caution!)
      console.log("[Divisions Seed API] Clearing all divisions...");

      const result = await prisma.division.deleteMany();

      return NextResponse.json(
        {
          success: true,
          message: "All divisions cleared",
          data: {
            deletedCount: result.count,
          },
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid action. Use: 'seed' or 'clear'",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[Divisions Seed API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
