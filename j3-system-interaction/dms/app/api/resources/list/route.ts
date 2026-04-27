import { NextResponse } from "next/server";

export async function GET() {
  try {
    const resourcesList = [
      {
        id: "AMB-942",
        type: "Ambulance",
        district: "Colombo",
        status: "Assigned",
        incident: "INC-892: Flood Evacuatio...",
        icon: "🚑",
      },
      {
        id: "RBT-118",
        type: "Rescue Boat",
        district: "Gampaha",
        status: "In Transit",
        incident: "INC-894: Search Ops - Kr...",
        icon: "⛵",
      },
      {
        id: "TM-099",
        type: "Ground Team",
        district: "Kalutara",
        status: "Available",
        incident: "Standby at Station 4",
        icon: "👷",
      },
      {
        id: "HV-221",
        type: "Heavy Vehicle",
        district: "Colombo",
        status: "Assigned",
        incident: "INC-890: Debris Clearanc...",
        icon: "🚛",
      },
      {
        id: "AMB-845",
        type: "Ambulance",
        district: "Gampaha",
        status: "Available",
        incident: "Standby at Station 1",
        icon: "🚑",
      },
    ];

    const deployment = {
      ambulances: { deployed: 42, total: 50 },
      rescue: { deployed: 28, total: 35 },
      groundTeams: { deployed: 65, total: 70 },
    };

    return NextResponse.json(
      { resources: resourcesList, deployment },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
