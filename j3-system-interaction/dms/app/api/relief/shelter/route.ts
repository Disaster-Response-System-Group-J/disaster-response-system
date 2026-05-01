import { NextResponse } from "next/server";

export async function GET() {
  try {
    const shelterData = {
      activeShelters: 142,
      activeSheltersChange: 12,
      totalOccupancy: 38400,
      occupancyChange: -18,
      remainingCapacity: 12,
      shelters: [
        {
          id: 1,
          name: "Galle Central School",
          district: "Galle",
          occupancy: 95,
          status: "critical",
        },
        {
          id: 2,
          name: "Karapithya Temple",
          district: "Galle",
          occupancy: 60,
          status: "low-supply",
        },
      ],
      stock: {
        dryRations: { amount: 45000, unit: "Pks", percentage: 75, warning: "Est. 4 Days Remaining" },
        potableWater: {
          amount: 120000,
          unit: "L",
          percentage: 45,
          warning: "Critical Replenishment Req.",
          isWarning: true,
        },
        blankets: {
          amount: 18500,
          unit: "Units",
          percentage: 60,
          warning: "Sufficient Status",
        },
      },
    };

    return NextResponse.json(shelterData, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
