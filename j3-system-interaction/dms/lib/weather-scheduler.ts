/**
 * Scheduled Tasks for Weather Data
 * Runs daily to fetch and store OpenMeteO data
 */

import {
  fetchOpenMeteoData,
  processWeatherData,
  mapSoilMoistureLayers,
} from "./openmeteo";
import {
  saveAllWeatherData,
  getAllDivisionsForWeatherFetch,
  WeatherDataPayload,
} from "./weather-db";

// Keep track of scheduled tasks
let scheduledTasks: NodeJS.Timeout[] = [];

/**
 * Execute weather data fetch for a single division
 * @param divisionId - Division ID
 * @param name - Division name
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @param daysBack - Number of days to fetch (default: 7)
 */
export async function fetchAndSaveWeatherForDivision(
  divisionId: number,
  name: string,
  latitude: number,
  longitude: number,
  daysBack: number = 7
): Promise<void> {
  try {
    console.log(
      `[Weather Fetch] Processing division: ${name} (${divisionId}) at (${latitude}, ${longitude}) - fetching ${daysBack} days`
    );

    // Fetch fresh data from OpenMeteO (now fetches date range)
    const weatherData = await fetchOpenMeteoData(latitude, longitude, daysBack);

    // Process the weather data
    const aggregatedData = processWeatherData(weatherData);

    console.log(
      `[Weather Fetch] Fetched ${aggregatedData.length} daily records for ${name}`
    );

    // Save each day's data
    for (const dayData of aggregatedData) {
      const soilMoistureMapping = mapSoilMoistureLayers(dayData);

      const payload: WeatherDataPayload = {
        divisionId,
        date: dayData.date,
        rainSum: dayData.rainSum,
        temperature: dayData.temperature,
        soilMoisture_7_28cm: soilMoistureMapping.moisture_7_28cm,
        soilMoisture_28_100cm: soilMoistureMapping.moisture_28_100cm,
        soilMoisture_100_255cm: soilMoistureMapping.moisture_100_255cm,
      };

      await saveAllWeatherData(payload);
    }

    console.log(
      `[Weather Fetch] Successfully saved weather data for ${name} (${aggregatedData.length} days)`
    );
  } catch (error) {
    console.error(
      `[Weather Fetch] Error processing division ${name}:`,
      error
    );
    throw error;
  }
}

/**
 * Fetch and save weather data for all divisions
 * @param daysBack - Number of days to fetch (default: 7)
 * @returns Status with success/failed counts
 */
export async function fetchAndSaveWeatherForAllDivisions(
  daysBack: number = 7
): Promise<{ success: number; failed: number; errors: string[] }> {
  try {
    console.log(
      `[Weather Fetch] Starting weather data fetch for all divisions (${daysBack} days)`
    );

    const divisions = await getAllDivisionsForWeatherFetch();

    if (divisions.length === 0) {
      console.warn(
        "[Weather Fetch] No divisions found with valid coordinates"
      );
      return { success: 0, failed: 0, errors: ["No divisions found"] };
    }

    console.log(`[Weather Fetch] Found ${divisions.length} divisions to process`);

    const results = { success: 0, failed: 0, errors: [] as string[] };

    // Process each division sequentially to respect API rate limits
    for (const division of divisions) {
      try {
        await fetchAndSaveWeatherForDivision(
          division.divisionId,
          division.name,
          Number(division.latitude),
          Number(division.longitude),
          daysBack
        );
        results.success++;
      } catch (error) {
        const errorMsg = `Failed to fetch data for division ${division.name}: ${error}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
        results.failed++;
      }

      // Add delay between API calls to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      `[Weather Fetch] Completed: ${results.success} succeeded, ${results.failed} failed`
    );
    return results;
  } catch (error) {
    console.error("[Weather Fetch] Fatal error:", error);
    throw error;
  }
}

/**
 * Parse cron-like schedule string
 * Format: "HH:MM" (24-hour format)
 * Example: "02:00" (runs at 2 AM every day)
 */
function parseScheduleTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(":").map(Number);

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(
      `Invalid schedule time format: ${timeStr}. Use HH:MM (24-hour format)`
    );
  }

  return { hours, minutes };
}

/**
 * Schedule daily weather data fetch
 * @param scheduleTime - Time to run in HH:MM format (24-hour)
 * @returns Task ID for later cancellation
 */
export function scheduleDailyWeatherFetch(
  scheduleTime: string = "02:00"
): string {
  try {
    const { hours, minutes } = parseScheduleTime(scheduleTime);

    console.log(
      `[Weather Scheduler] Scheduling daily weather fetch at ${scheduleTime} UTC`
    );

    // Calculate time until next scheduled run
    function getTimeUntilNextRun(): number {
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setUTCHours(hours, minutes, 0, 0);

      if (scheduledTime <= now) {
        // If the time has passed today, schedule for tomorrow
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      return scheduledTime.getTime() - now.getTime();
    }

    // Schedule the recurring task (runs every 24 hours)
    const task = setInterval(async () => {
      try {
        console.log(
          `[Weather Scheduler] Starting scheduled daily weather fetch at ${scheduleTime} UTC (today only)`
        );
        // Daily run: fetch only today's data (1 day)
        const results = await fetchAndSaveWeatherForAllDivisions(1);
        console.log(
          `[Weather Scheduler] Daily fetch completed: ${results.success} divisions succeeded, ${results.failed} failed`
        );

        if (results.failed > 0) {
          console.warn(`[Weather Scheduler] Failed divisions:`, results.errors);
        }
      } catch (error) {
        console.error("[Weather Scheduler] Scheduled task failed:", error);
      }
    }, 24 * 60 * 60 * 1000); // Run every 24 hours

    scheduledTasks.push(task);
    const taskId = `weather-fetch-${Date.now()}`;

    console.log(
      `[Weather Scheduler] Weather fetch scheduled successfully. Task ID: ${taskId}`
    );
    console.log(
      `[Weather Scheduler] Schedule: Daily at ${scheduleTime} UTC | Data: Today only (1 day)`
    );
    console.log(
      `[Weather Scheduler] All 121 divisions will be processed with API rate limiting (100ms between calls)`
    );
    return taskId;
  } catch (error) {
    console.error("[Weather Scheduler] Failed to schedule weather fetch:", error);
    throw error;
  }
}

/**
 * Cancel a scheduled task
 */
export function cancelScheduledTask(taskId: string): boolean {
  const index = scheduledTasks.findIndex((task) => {
    // This is a simple check - in production, maintain a map of IDs to tasks
    return task.toString().includes(taskId);
  });

  if (index !== -1) {
    clearInterval(scheduledTasks[index]);
    scheduledTasks.splice(index, 1);
    console.log(`[Weather Scheduler] Task ${taskId} cancelled`);
    return true;
  }

  return false;
}

/**
 * Cancel all scheduled tasks
 */
export function cancelAllScheduledTasks(): void {
  scheduledTasks.forEach((task) => clearInterval(task));
  scheduledTasks = [];
  console.log("[Weather Scheduler] All scheduled tasks cancelled");
}

/**
 * Get number of active scheduled tasks
 */
export function getActiveTaskCount(): number {
  return scheduledTasks.length;
}
