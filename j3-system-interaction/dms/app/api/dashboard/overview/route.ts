import { NextResponse } from "next/server";

export async function GET() {
  try {
    const dashboardData = {
      activeIncidents: 142,
      activeIncidentsChange: 12,
      criticalAlerts: 8,
      peopleAffected: 45200,
      peopleAffectedChange: 15,
      inShelters: 12400,
      incidents: {
        floods: 86,
        landslides: 41,
        other: 15,
      },
      resources: {
        availableTeams: { current: 124, total: 150 },
        activeShelters: { current: 86, total: 120 },
        heavyMachinery: { current: 45, total: 90 },
      },
      alerts: [
        {
          id: 1,
          severity: "critical",
          title: "Earthquake Alert - Magnitude 5.2",
          location: "Northern District",
          time: "15 minutes ago",
        },
        {
          id: 2,
          severity: "high",
          title: "Flooding Risk Assessment",
          location: "River Basin Area",
          time: "32 minutes ago",
        },
        {
          id: 3,
          severity: "medium",
          title: "Storm Warning Issued",
          location: "Coastal Region",
          time: "1 hour ago",
        },
        {
          id: 4,
          severity: "low",
          title: "Road Damage Report",
          location: "Highway 5",
          time: "2 hours ago",
        },
      ],
    };

    return NextResponse.json(dashboardData, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
