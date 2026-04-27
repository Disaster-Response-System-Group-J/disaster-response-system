import { NextResponse } from "next/server";

export async function GET() {
  try {
    const incidents = [
      {
        id: "FL-RAT-094",
        severity: "critical",
        title: "Severe Flooding in Ratnapura",
        location: "Ratnapura District, Sabaragamuwa Province",
        population: 12450,
        populationChange: 15,
        hazard: "Flash Flood",
        hazardLevel: "Level 4 Warning",
        weather: "Heavy Rain 145mm",
        weatherProb: 95,
        events: [
          {
            time: "08:45 AM - TODAY",
            title: "Initial Report Logged",
            description:
              "Multiple civilian reports via 119 emergency hotline regarding rapid water level rise in Kalu Ganga.",
          },
          {
            time: "09:15 AM - TODAY",
            title: "Severity Evaluated",
            description:
              "Satellite imagery confirmed widespread inundation. Upgraded to Critical Severity (Level 4).",
          },
        ],
      },
    ];

    return NextResponse.json(incidents, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
