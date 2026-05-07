/**
 * API Route: Manual Weather Data Fetch
 * POST /api/weather/fetch - Trigger manual fetch
 * GET /api/weather/fetch - Show usage
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchAndSaveWeatherForAllDivisions } from "@/lib/weather-scheduler";

export async function POST(request: NextRequest) {
  try {
    // Optional: Add auth check here
    // if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const daysBack = Math.min(Math.max(body.daysBack || 7, 1), 30); // Default 7 days, min 1, max 30

    console.log("[Weather API] Manual fetch triggered", { daysBack });

    const results = await fetchAndSaveWeatherForAllDivisions(daysBack);

    return NextResponse.json(
      {
        success: true,
        message: `Weather data fetch completed for ${daysBack} days`,
        data: results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Weather API] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: "Weather data fetch service for all 121 divisions",
      description: "Fetches historical weather data and stores daily aggregates in database",
      usage: {
        method: "POST",
        endpoint: "/api/weather/fetch",
        body: {
          daysBack: "Number of days to fetch (1-30, default: 7)",
        },
        examples: [
          {
            description: "Fetch 7 days (default)",
            command: "curl -X POST http://localhost:3000/api/weather/fetch -H 'Content-Type: application/json' -d '{}'",
          },
          {
            description: "Fetch last 14 days",
            command: "curl -X POST http://localhost:3000/api/weather/fetch -H 'Content-Type: application/json' -d '{\"daysBack\": 14}'",
          },
        ],
      },
      features: {
        "Hourly soil moisture": "Aggregated to daily averages from 24 hourly readings",
        "Daily rainfall": "Accumulated precipitation data",
        "Daily temperature": "Average of daily min/max",
        "Layer mapping": "OpenMeteO (0-1cm, 1-3cm, 3-9cm) → DB (7-28cm, 28-100cm, 100-255cm)",
        "Rate limiting": "100ms delay between per-division API calls",
        "Coverage": "All 121 Sri Lankan divisions",
      },
    },
    { status: 200 }
  );
}
