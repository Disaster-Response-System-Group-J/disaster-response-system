import { NextResponse } from "next/server";

export async function GET() {
  try {
    const situationData = {
      avgResponseTime: 14,
      avgResponseTimeChange: 2.4,
      totalRelief: 84.2,
      totalReliefChange: 15,
      totalRescued: 1248,
      rescuedDistricts: 14,
    };

    return NextResponse.json(situationData, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
