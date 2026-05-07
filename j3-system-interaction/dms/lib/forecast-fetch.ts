/**
 * Forecast Weather Fetch
 * Fetches the next N days of weather from Open-Meteo and saves to forecast_weather_data.
 */

import { PrismaClient } from "@prisma/client";
import {
  fetchOpenMeteoData,
  processWeatherData,
  mapSoilMoistureLayers,
} from "./openmeteo";

const prisma = new PrismaClient();

/**
 * Fetch future forecast weather for a single division and upsert into forecast_weather_data.
 * @param daysAhead  How many future days to fetch (default 3 = tomorrow through D+3).
 */
export async function fetchAndSaveForecastWeatherForDivision(
  divisionId: number,
  name: string,
  latitude: number,
  longitude: number,
  daysAhead: number = 3
): Promise<void> {
  // Build end date = today + daysAhead, then use daysAhead as the window.
  // fetchOpenMeteoData computes: start = end - (daysAhead - 1)
  //   → start = today+daysAhead - (daysAhead-1) = today+1 = tomorrow  ✓
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysAhead);
  const endDateStr = endDate.toISOString().split("T")[0];

  console.log(
    `[ForecastFetch] ${name} (${divisionId}) — fetching ${daysAhead} days ahead (up to ${endDateStr})`
  );

  const rawData = await fetchOpenMeteoData(latitude, longitude, daysAhead, endDateStr);
  const days = processWeatherData(rawData);

  for (const day of days) {
    const soil = mapSoilMoistureLayers(day);

    await prisma.forecastWeatherData.upsert({
      where: {
        divisionId_date: { divisionId, date: new Date(day.date) },
      },
      update: {
        rainSum: day.rainSum,
        temperature: day.temperature,
        moisture7_28cm: soil.moisture_7_28cm,
        moisture28_100cm: soil.moisture_28_100cm,
        moisture100_255cm: soil.moisture_100_255cm,
        fetchedAt: new Date(),
      },
      create: {
        divisionId,
        date: new Date(day.date),
        rainSum: day.rainSum,
        temperature: day.temperature,
        moisture7_28cm: soil.moisture_7_28cm,
        moisture28_100cm: soil.moisture_28_100cm,
        moisture100_255cm: soil.moisture_100_255cm,
      },
    });
  }

  console.log(`[ForecastFetch] ✓ ${name} — ${days.length} forecast days saved`);
}

/**
 * Fetch and save forecast weather for every division with valid coordinates.
 */
export async function fetchForecastForAllDivisions(
  daysAhead: number = 3
): Promise<{ success: number; failed: number; errors: string[] }> {
  const divisions = await prisma.division.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
    select: { divisionId: true, name: true, latitude: true, longitude: true },
  });

  console.log(
    `[ForecastFetch] Processing ${divisions.length} divisions (${daysAhead} days ahead)`
  );

  const results = { success: 0, failed: 0, errors: [] as string[] };

  for (const div of divisions) {
    try {
      await fetchAndSaveForecastWeatherForDivision(
        div.divisionId,
        div.name,
        Number(div.latitude),
        Number(div.longitude),
        daysAhead
      );
      results.success++;
    } catch (err) {
      const msg = `${div.name}: ${err}`;
      console.error(`[ForecastFetch] ✗ ${msg}`);
      results.errors.push(msg);
      results.failed++;
    }

    // Respect Open-Meteo rate limits
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(
    `[ForecastFetch] Done — ${results.success} OK, ${results.failed} failed`
  );
  return results;
}
