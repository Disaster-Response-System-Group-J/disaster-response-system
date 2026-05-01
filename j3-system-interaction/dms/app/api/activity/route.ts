// app/api/activity/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const activityData = [
      {
        id: "1",
        time: "14:45",
        date: "TODAY, OCT 24",
        category: "WEATHER WARNING",
        type: "weather",
        source: "LKA METEOROLOGICAL DEPT",
        description: "Cyclon warning upgraded to severe for Western Province. Wind speeds expected to exceed 90km/h. Immediate securing of loose structures advised.",
        tags: ["COLOMBO", "GAMPAHA"]
      },
      {
        id: "2",
        time: "14:12",
        date: "TODAY, OCT 24",
        category: "RESOURCE DISPATCH",
        type: "dispatch",
        source: "AIR FORCE CMD",
        description: "2 Medevac units (Alpha-1, Bravo-2) dispatched to coordinate 06.9271° N, 79.8612° E for emergency evacuation of civilian personnel."
      },
      {
        id: "3",
        time: "13:50",
        date: "TODAY, OCT 24",
        category: "GROUND OPS STATUS CHANGE",
        type: "status",
        source: "ENGINEERING CORPS",
        description: "Route Alpha (A2 Highway) cleared of debris by engineering corps. Supply lines are now fully operational for heavy transport."
      },
      {
        id: "4",
        time: "13:15",
        date: "TODAY, OCT 24",
        category: "CIVILIAN REPORT NEW INCIDENT",
        type: "incident",
        source: "SUB-SECTOR 4",
        description: "Localized power grid failure reported in Sub-sector 4. Initial assessment indicates transformer damage due to lightning strike.",
        incidentId: "INC-992"
      },
      {
        id: "5",
        time: "22:30",
        date: "YESTERDAY, OCT 23",
        category: "LOGISTICS CMD",
        type: "logistics",
        source: "DISTRIBUTION CENTER DELTA",
        description: "Convoy 04 reached distribution center Delta. 50 tons of water purification tablets securely unloaded."
      }
    ];

    return NextResponse.json(activityData, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}