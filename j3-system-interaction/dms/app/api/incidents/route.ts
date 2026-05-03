import { NextResponse } from "next/server";
import { MOCK_CONFIRMED_INCIDENTS } from "@/data/mock-data";

export async function GET() {
  try {
    return NextResponse.json(MOCK_CONFIRMED_INCIDENTS);
  } catch (error) {
    console.error("Incidents API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch incidents data" },
      { status: 500 }
    );
  }
}
