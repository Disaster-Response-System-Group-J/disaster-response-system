/**
 * API Route: List Divisions
 * GET /api/divisions - Get all divisions
 * GET /api/divisions?province=Central - Filter by province
 * GET /api/divisions?district=Kandy - Filter by district
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const province = searchParams.get("province");
    const district = searchParams.get("district");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (province) where.province = province;
    if (district) where.district = district;

    // Get divisions
    const [divisions, total] = await Promise.all([
      prisma.division.findMany({
        where,
        select: {
          divisionId: true,
          locationId: true,
          name: true,
          district: true,
          province: true,
          latitude: true,
          longitude: true,
        },
        orderBy: [{ province: "asc" }, { district: "asc" }, { name: "asc" }],
        skip,
        take: limit,
      }),
      prisma.division.count({ where }),
    ]);

    // Get distinct provinces and districts
    const [provinces, districts] = await Promise.all([
      prisma.division.findMany({
        select: { province: true },
        distinct: ["province"],
        orderBy: { province: "asc" },
      }),
      prisma.division.findMany({
        select: { district: true },
        distinct: ["district"],
        orderBy: { district: "asc" },
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        message: "Divisions retrieved successfully",
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        filters: {
          availableProvinces: provinces.map((p) => p.province).filter(Boolean),
          availableDistricts: districts.map((d) => d.district).filter(Boolean),
          currentFilters: {
            province: province || null,
            district: district || null,
          },
        },
        data: divisions.map((d) => ({
          id: d.divisionId,
          locationId: d.locationId,
          name: d.name,
          district: d.district,
          province: d.province,
          latitude: d.latitude,
          longitude: d.longitude,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Divisions List API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
