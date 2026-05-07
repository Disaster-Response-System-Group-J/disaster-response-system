/**
 * API Route: Weather Scheduler Management
 * GET /api/weather/scheduler/status - Get scheduler status
 * POST /api/weather/scheduler/start - Start scheduler
 * POST /api/weather/scheduler/stop - Stop scheduler
 */

import { NextRequest, NextResponse } from "next/server";
import {
  scheduleDailyWeatherFetch,
  cancelAllScheduledTasks,
  getActiveTaskCount,
  fetchAndSaveWeatherForAllDivisions,
} from "@/lib/weather-scheduler";

// Global singleton to store scheduler state
let schedulerState: {
  active: boolean;
  taskId: string | null;
  scheduleTime: string;
  startedAt: Date | null;
} = {
  active: false,
  taskId: null,
  scheduleTime: "02:00",
  startedAt: null,
};

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      {
        success: true,
        scheduler: {
          ...schedulerState,
          activeTaskCount: getActiveTaskCount(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Scheduler API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || request.nextUrl.searchParams.get("action");

    switch (action) {
      case "start": {
        if (schedulerState.active) {
          return NextResponse.json(
            {
              success: false,
              error: "Scheduler is already running",
            },
            { status: 400 }
          );
        }

        const scheduleTime = body.scheduleTime || "02:00";

        const taskId = scheduleDailyWeatherFetch(scheduleTime);

        schedulerState.active = true;
        schedulerState.taskId = taskId;
        schedulerState.scheduleTime = scheduleTime;
        schedulerState.startedAt = new Date();

        // Optionally run immediately on start
        const runNow = body.runNow !== false;
        if (runNow) {
          console.log("[Scheduler API] Running fetch immediately");
          fetchAndSaveWeatherForAllDivisions().catch((error) =>
            console.error("[Scheduler API] Immediate run failed:", error)
          );
        }

        return NextResponse.json(
          {
            success: true,
            message: "Scheduler started successfully",
            scheduler: schedulerState,
          },
          { status: 200 }
        );
      }

      case "stop": {
        if (!schedulerState.active) {
          return NextResponse.json(
            {
              success: false,
              error: "Scheduler is not running",
            },
            { status: 400 }
          );
        }

        cancelAllScheduledTasks();

        schedulerState.active = false;
        schedulerState.taskId = null;
        schedulerState.startedAt = null;

        return NextResponse.json(
          {
            success: true,
            message: "Scheduler stopped successfully",
            scheduler: schedulerState,
          },
          { status: 200 }
        );
      }

      case "restart": {
        if (schedulerState.active) {
          cancelAllScheduledTasks();
        }

        const scheduleTime = body.scheduleTime || schedulerState.scheduleTime;
        const taskId = scheduleDailyWeatherFetch(scheduleTime);

        schedulerState.active = true;
        schedulerState.taskId = taskId;
        schedulerState.scheduleTime = scheduleTime;
        schedulerState.startedAt = new Date();

        return NextResponse.json(
          {
            success: true,
            message: "Scheduler restarted successfully",
            scheduler: schedulerState,
          },
          { status: 200 }
        );
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action. Use: 'start', 'stop', or 'restart'",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Scheduler API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
