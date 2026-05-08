/**
 * STUB — openmeteo.ts was not merged to main.
 * These types and stubs satisfy forecast-fetch.ts imports so the build passes.
 * Restore the real Open-Meteo API implementation once the weather-integration
 * branch is merged.
 */

export interface OpenMeteoResponse {
  daily: {
    time: string[];
    precipitation_sum: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
  };
  hourly: {
    time: string[];
    soil_moisture_0_to_1cm: (number | null)[];
    soil_moisture_1_to_3cm: (number | null)[];
    soil_moisture_3_to_9cm: (number | null)[];
  };
}

export interface DayWeatherData {
  date: string;
  rainSum: number | null;
  temperature: number | null;
  soil_moisture_0_to_1cm: number | null;
  soil_moisture_1_to_3cm: number | null;
  soil_moisture_3_to_9cm: number | null;
}

export async function fetchOpenMeteoData(
  _latitude: number,
  _longitude: number,
  _daysAhead: number,
  _endDateStr: string
): Promise<OpenMeteoResponse> {
  console.warn("[OpenMeteo] stub — openmeteo.ts not yet merged");
  return {
    daily: { time: [], precipitation_sum: [], temperature_2m_max: [], temperature_2m_min: [] },
    hourly: { time: [], soil_moisture_0_to_1cm: [], soil_moisture_1_to_3cm: [], soil_moisture_3_to_9cm: [] },
  };
}

export function processWeatherData(_raw: OpenMeteoResponse): DayWeatherData[] {
  return [];
}

export function mapSoilMoistureLayers(_day: DayWeatherData): {
  moisture_7_28cm: number | null;
  moisture_28_100cm: number | null;
  moisture_100_255cm: number | null;
} {
  return { moisture_7_28cm: null, moisture_28_100cm: null, moisture_100_255cm: null };
}
