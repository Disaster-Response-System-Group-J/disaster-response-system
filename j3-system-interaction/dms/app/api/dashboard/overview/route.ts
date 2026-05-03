import { NextResponse } from "next/server";
import { MOCK_DASHBOARD_SUMMARY } from "@/data/mock-data";

export async function GET() {
  try {
    return NextResponse.json(MOCK_DASHBOARD_SUMMARY);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
