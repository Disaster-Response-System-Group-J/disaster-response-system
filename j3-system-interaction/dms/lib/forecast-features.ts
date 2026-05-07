/**
 * Forecast Feature Computation
 * Derives the 7 engineered features (rain_lag_1, rain_rolling_3d/7d, month_sin/cos,
 * spi, division_encoded) for each row in forecast_weather_data and saves to forecast_features.
 *
 * Strategy:
 *  - Fetch last 7 days of actual RainfallData to seed the lag/rolling windows.
 *  - Fetch forecast rain_sum values from ForecastWeatherData (D+1, D+2, D+3).
 *  - Build a combined series: [last-7-actual … forecast-days].
 *  - Compute SPI by fitting gamma on ALL historical rainfall, then mapping forecast values.
 *  - For each forecast day, compute lag and rolling from the combined series.
 */

import { PrismaClient } from "@prisma/client";
import { computeSPIWithReference } from "./spi";
import { DIVISION_ENCODING } from "./compute-features";

const prisma = new PrismaClient();

export async function computeAndSaveForecastFeatures(): Promise<{
  success: number;
  failed: number;
}> {
  const results = { success: 0, failed: 0 };

  const divisions = await prisma.division.findMany({
    select: { divisionId: true, name: true },
    orderBy: { name: "asc" },
  });

  for (const division of divisions) {
    try {
      // 1. Get the 3-day forecast rain values (future dates)
      const forecastDays = await prisma.forecastWeatherData.findMany({
        where: { divisionId: division.divisionId },
        orderBy: { date: "asc" },
        select: { date: true, rainSum: true },
      });

      if (forecastDays.length === 0) {
        console.log(`[ForecastFeatures] Skipping ${division.name} — no forecast data`);
        continue;
      }

      // 2. Get last 7 days of actual rainfall for lag/rolling context (ascending)
      const recentActual = await prisma.rainfallData.findMany({
        where: { divisionId: division.divisionId },
        orderBy: { date: "desc" },
        take: 7,
        select: { date: true, rainSum: true },
      });
      recentActual.reverse();

      // 3. Get ALL historical rainfall for SPI gamma fitting
      const allHistorical = await prisma.rainfallData.findMany({
        where: { divisionId: division.divisionId },
        orderBy: { date: "asc" },
        select: { rainSum: true },
      });
      const historicalRainSums = allHistorical.map((r) => r.rainSum);

      // 4. Build combined series [recent-actual | forecast]
      const combined: { date: Date; rainSum: number | null }[] = [
        ...recentActual,
        ...forecastDays,
      ];
      const forecastStartIdx = recentActual.length;

      // 5. Compute SPI for forecast values using the historical distribution
      const forecastRainSums = forecastDays.map((d) => d.rainSum);
      const forecastSPIs = computeSPIWithReference(historicalRainSums, forecastRainSums);

      const divisionEncoded = DIVISION_ENCODING[division.name] ?? null;

      // 6. Compute and upsert features for each forecast day
      for (let fi = 0; fi < forecastDays.length; fi++) {
        const combinedIdx = forecastStartIdx + fi;
        const { date } = forecastDays[fi];
        const month = date.getMonth() + 1;

        const rainLag1 =
          combinedIdx >= 1 ? combined[combinedIdx - 1].rainSum : null;

        const rainRolling3d =
          combinedIdx >= 2
            ? combined
                .slice(combinedIdx - 2, combinedIdx + 1)
                .reduce((s, r) => s + (r.rainSum ?? 0), 0)
            : null;

        const rainRolling7d =
          combinedIdx >= 6
            ? combined
                .slice(combinedIdx - 6, combinedIdx + 1)
                .reduce((s, r) => s + (r.rainSum ?? 0), 0)
            : null;

        const payload = {
          rainLag1,
          rainRolling3d,
          rainRolling7d,
          monthSin: Math.sin((2 * Math.PI * month) / 12),
          monthCos: Math.cos((2 * Math.PI * month) / 12),
          spi: forecastSPIs[fi],
          divisionEncoded,
        };

        await prisma.forecastFeatures.upsert({
          where: {
            divisionId_date: { divisionId: division.divisionId, date },
          },
          update: payload,
          create: { divisionId: division.divisionId, date, ...payload },
        });
      }

      console.log(
        `[ForecastFeatures] ✓ ${division.name} — ${forecastDays.length} forecast days`
      );
      results.success++;
    } catch (error) {
      console.error(`[ForecastFeatures] ✗ ${division.name}:`, error);
      results.failed++;
    }
  }

  return results;
}
