/**
 * Weather System Initialization
 * Add this to your Next.js app initialization (e.g., in layout.tsx or middleware)
 * 
 * This ensures the weather scheduler starts automatically when the app starts
 * and performs historical backfill on first run
 */

import { scheduleDailyWeatherFetch, fetchAndSaveWeatherForAllDivisions } from "@/lib/weather-scheduler";
import { runForecastPipeline, scheduleDailyPredictionPipeline } from "@/lib/prediction-pipeline";

/**
 * Perform initial 7-day historical backfill
 * Fetches and stores the last 7 days of weather data for all divisions
 */
async function performHistoricalBackfill() {
  try {
    console.log(
      "[Weather Init] Starting 7-day historical backfill on first run..."
    );

    const results = await fetchAndSaveWeatherForAllDivisions(7);

    console.log(
      `[Weather Init] Backfill completed: ${results.success} divisions processed, ${results.failed} failed`
    );

    if (results.failed > 0) {
      console.warn("[Weather Init] Some divisions failed during backfill:");
      results.errors.forEach((err) => console.warn(`  - ${err}`));
    }

    // Mark backfill as complete
    process.env.WEATHER_BACKFILL_COMPLETED = "true";
    console.log("[Weather Init] Historical backfill marked complete");
  } catch (error) {
    console.error("[Weather Init] Historical backfill failed:", error);
    // Continue - scheduler will still initialize even if backfill fails
  }
}

/**
 * Initialize the weather data system
 * - Performs 7-day historical backfill on first run
 * - Starts daily weather fetch scheduler
 * Call this once during app startup
 */
export async function initializeWeatherSystem() {
  try {
    // Check if already initialized (to prevent multiple schedules in dev)
    const existingScheduler = process.env.WEATHER_SCHEDULER_INITIALIZED;

    if (existingScheduler === "true") {
      console.log("[Weather Init] Weather scheduler already initialized");
      return;
    }

    console.log("[Weather Init] Initializing weather system...");

    // Perform 7-day historical backfill if not already done
    const backfillDone = process.env.WEATHER_BACKFILL_COMPLETED;
    if (!backfillDone) {
      console.log("[Weather Init] No backfill detected. Performing 7-day backfill...");
      await performHistoricalBackfill();
    }

    // Start daily weather fetch at configured time
    // Change "02:00" to your preferred time in HH:MM format (24-hour)
    const scheduleTime = process.env.WEATHER_FETCH_TIME || "02:00";
    const isEnabled = process.env.WEATHER_ENABLED !== "false";

    if (!isEnabled) {
      console.log("[Weather Init] Weather system disabled via WEATHER_ENABLED");
      return;
    }

    console.log(
      `[Weather Init] Starting daily weather scheduler. Schedule: daily at ${scheduleTime} UTC`
    );

    scheduleDailyWeatherFetch(scheduleTime);

    // Run an initial forecast pipeline immediately so predictions are available on startup
    console.log("[Weather Init] Running initial forecast + prediction pipeline...");
    runForecastPipeline().catch((err) =>
      console.error("[Weather Init] Initial forecast pipeline failed:", err)
    );

    // Schedule the daily forecast + prediction pipeline at 03:00 UTC
    // (runs 1 hour after the historical weather fetch so context data is fresh)
    const predictionScheduleTime = process.env.PREDICTION_RUN_TIME || "03:00";
    scheduleDailyPredictionPipeline(predictionScheduleTime);

    // Mark as initialized to prevent duplicate schedules
    process.env.WEATHER_SCHEDULER_INITIALIZED = "true";

    console.log(
      "[Weather Init] Weather system fully initialized (historical scheduler + forecast pipeline)"
    );
  } catch (error) {
    console.error("[Weather Init] Failed to initialize weather system:", error);
    // Don't throw - allow app to continue even if weather system fails to initialize
  }
}

/**
 * Usage in Next.js Layout (app/layout.tsx):
 * 
 * export default async function RootLayout({
 *   children,
 * }: {
 *   children: React.ReactNode;
 * }) {
 *   // Initialize weather system on app startup
 *   if (typeof window === "undefined") { // Server-side only
 *     await initializeWeatherSystem();
 *   }
 * 
 *   return (
 *     <html lang="en">
 *       <body>{children}</body>
 *     </html>
 *   );
 * }
 */

/**
 * Alternative Usage - Manual Initialization
 * Create a custom route that initializes the system:
 * 
 * // app/api/init/weather/route.ts
 * import { NextResponse } from "next/server";
 * import { initializeWeatherSystem } from "@/lib/weather-init";
 * 
 * export async function GET() {
 *   try {
 *     await initializeWeatherSystem();
 *     return NextResponse.json({
 *       success: true,
 *       message: "Weather system initialized",
 *     });
 *   } catch (error) {
 *     return NextResponse.json({
 *       success: false,
 *       error: error instanceof Error ? error.message : "Unknown error",
 *     }, { status: 500 });
 *   }
 * }
 * 
 * Then call: curl http://localhost:3000/api/init/weather
 */

/**
 * Alternative Usage - Environment Variables
 * 
 * Set in .env.local:
 * WEATHER_FETCH_TIME=02:00        # Daily fetch time (24-hour format)
 * WEATHER_ENABLED=true             # Enable/disable weather system
 */
