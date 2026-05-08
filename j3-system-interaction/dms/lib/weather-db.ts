/**
 * Database Service for Weather Data
 * Handles saving OpenMeteO data to the database
 */

import { PrismaClient } from "@prisma/client";

let _prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

export interface WeatherDataPayload {
  divisionId: number;
  date: string; // ISO format: YYYY-MM-DD
  rainSum: number | null;
  temperature: number | null;
  soilMoisture_7_28cm: number | null;
  soilMoisture_28_100cm: number | null;
  soilMoisture_100_255cm: number | null;
}

/**
 * Save or update rainfall data
 */
export async function saveRainfallData(
  divisionId: number,
  date: string,
  rainSum: number | null
) {
  try {
    const result = await getPrisma().rainfallData.upsert({
      where: {
        divisionId_date: {
          divisionId,
          date: new Date(date),
        },
      },
      update: {
        rainSum,
      },
      create: {
        divisionId,
        date: new Date(date),
        rainSum,
      },
    });
    return result;
  } catch (error) {
    console.error("Error saving rainfall data:", error);
    throw error;
  }
}

/**
 * Save or update soil moisture data
 */
export async function saveSoilMoistureData(
  divisionId: number,
  date: string,
  moisture_7_28cm: number | null,
  moisture_28_100cm: number | null,
  moisture_100_255cm: number | null
) {
  try {
    const result = await getPrisma().soilMoisture.upsert({
      where: {
        divisionId_date: {
          divisionId,
          date: new Date(date),
        },
      },
      update: {
        moisture_7_28cm,
        moisture_28_100cm,
        moisture_100_255cm,
      },
      create: {
        divisionId,
        date: new Date(date),
        moisture_7_28cm,
        moisture_28_100cm,
        moisture_100_255cm,
      },
    });
    return result;
  } catch (error) {
    console.error("Error saving soil moisture data:", error);
    throw error;
  }
}

/**
 * Save or update temperature data
 */
export async function saveTemperatureData(
  divisionId: number,
  date: string,
  temperature: number | null
) {
  try {
    const result = await getPrisma().temperatureData.upsert({
      where: {
        divisionId_date: {
          divisionId,
          date: new Date(date),
        },
      },
      update: {
        temperature,
      },
      create: {
        divisionId,
        date: new Date(date),
        temperature,
      },
    });
    return result;
  } catch (error) {
    console.error("Error saving temperature data:", error);
    throw error;
  }
}

/**
 * Save all weather data for a division
 */
export async function saveAllWeatherData(payload: WeatherDataPayload) {
  try {
    const [rainfall, soilMoisture, temperature] = await Promise.all([
      saveRainfallData(payload.divisionId, payload.date, payload.rainSum),
      saveSoilMoistureData(
        payload.divisionId,
        payload.date,
        payload.soilMoisture_7_28cm,
        payload.soilMoisture_28_100cm,
        payload.soilMoisture_100_255cm
      ),
      saveTemperatureData(
        payload.divisionId,
        payload.date,
        payload.temperature
      ),
    ]);

    return {
      rainfall,
      soilMoisture,
      temperature,
    };
  } catch (error) {
    console.error("Error saving all weather data:", error);
    throw error;
  }
}

/**
 * Get all divisions with coordinates for weather fetching
 */
export async function getAllDivisionsForWeatherFetch() {
  try {
    const divisions = await getPrisma().division.findMany({
      where: {
        latitude: {
          not: null,
        },
        longitude: {
          not: null,
        },
      },
      select: {
        divisionId: true,
        name: true,
        latitude: true,
        longitude: true,
      },
    });

    return divisions;
  } catch (error) {
    console.error("Error fetching divisions:", error);
    throw error;
  }
}

/**
 * Get latest weather data for a division
 */
export async function getLatestWeatherData(divisionId: number) {
  try {
    const [rainfall, soilMoisture, temperature] = await Promise.all([
      getPrisma().rainfallData.findFirst({
        where: { divisionId },
        orderBy: { date: "desc" },
      }),
      getPrisma().soilMoisture.findFirst({
        where: { divisionId },
        orderBy: { date: "desc" },
      }),
      getPrisma().temperatureData.findFirst({
        where: { divisionId },
        orderBy: { date: "desc" },
      }),
    ]);

    return {
      rainfall,
      soilMoisture,
      temperature,
    };
  } catch (error) {
    console.error("Error fetching latest weather data:", error);
    throw error;
  }
}
