/**
 * API Route: Weather System Status and Initialization
 * GET /api/weather/status - Get weather system status
 */

import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json(
      {
        success: true,
        message: "Weather data system is operational",
        endpoints: {
          status: {
            method: "GET",
            path: "/api/weather/status",
            description: "Get weather system status",
          },
        },
        notes: [
          "Weather data fetching and ML predictions have been migrated to the J2 Data Intelligence Python microservice",
          "Soil moisture data from OpenMeteO is aggregated from hourly to daily values",
          "OpenMeteO provides 0-1cm, 1-3cm, 3-9cm layers - mapped to database 7-28cm, 28-100cm, 100-255cm",
          "Rate limited to ~100ms between division requests to respect API limits",
          "All timestamps are in UTC",
        ],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Weather Status API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
