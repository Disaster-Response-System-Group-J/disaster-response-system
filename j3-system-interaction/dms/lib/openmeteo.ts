/**
 * OpenMeteO Weather Data Service
 * Fetches daily weather data and aggregates hourly soil moisture data
 */

interface WeatherData {
  latitude: number;
  longitude: number;
  daily: {
    time: string[];
    rain_sum: (number | null)[];
    apparent_temperature_max: (number | null)[];
    apparent_temperature_min: (number | null)[];
  };
  hourly: {
    time: string[];
    soil_moisture_0_to_1cm: (number | null)[];
    soil_moisture_1_to_3cm: (number | null)[];
    soil_moisture_3_to_9cm: (number | null)[];
  };
}

interface AggregatedData {
  date: string;
  rainSum: number | null;
  temperature: number | null;
  soilMoisture_0_1cm: number | null;
  soilMoisture_1_3cm: number | null;
  soilMoisture_3_9cm: number | null;
}

/**
 * Fetch weather data from OpenMeteO API
 * @param latitude - Location latitude
 * @param longitude - Location longitude
 * @param daysBack - Number of days to fetch (default: 7 for last 7 days)
 * @param endDate - End date for the range (default: today, ISO format: YYYY-MM-DD)
 * @returns Weather data for the specified date range
 */
export async function fetchOpenMeteoData(
  latitude: number,
  longitude: number,
  daysBack: number = 7,
  endDate?: string
): Promise<WeatherData> {
  const baseUrl = "https://api.open-meteo.com/v1/forecast";

  // Calculate date range
  const end = endDate ? new Date(endDate) : new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (daysBack - 1)); // -1 because we want inclusive range

  const start_date = start.toISOString().split("T")[0];
  const end_date = end.toISOString().split("T")[0];

  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    daily: [
      "rain_sum",
      "apparent_temperature_max",
      "apparent_temperature_min",
    ].join(","),
    hourly: [
      "soil_moisture_0_to_1cm",
      "soil_moisture_1_to_3cm",
      "soil_moisture_3_to_9cm",
    ].join(","),
    timezone: "auto",
    start_date,
    end_date,
  });

  try {
    console.log(
      `[OpenMeteO] Fetching ${daysBack} days of data from ${start_date} to ${end_date}`
    );
    const response = await fetch(`${baseUrl}?${params}`);

    if (!response.ok) {
      throw new Error(`OpenMeteO API error: ${response.statusText}`);
    }

    const data: WeatherData = await response.json();
    console.log(
      `[OpenMeteO] Successfully fetched data. Daily records: ${data.daily.time.length}, Hourly readings: ${data.hourly.time.length}`
    );
    return data;
  } catch (error) {
    console.error("Failed to fetch OpenMeteO data:", error);
    throw error;
  }
}

/**
 * Aggregate hourly soil moisture data to daily averages
 * @param hourlyData - Hourly time series data
 * @param date - Target date (ISO format: YYYY-MM-DD)
 * @returns Daily aggregated soil moisture values
 */
function aggregateSoilMoistureToDaily(
  hourlyData: WeatherData["hourly"],
  date: string
): { soil_0_1cm: number | null; soil_1_3cm: number | null; soil_3_9cm: number | null } {
  const targetDate = new Date(date).toDateString();

  // Filter hourly data for the specified date
  const indices = hourlyData.time
    .map((time, idx) => ({
      idx,
      date: new Date(time).toDateString(),
    }))
    .filter((item) => item.date === targetDate)
    .map((item) => item.idx);

  if (indices.length === 0) {
    return { soil_0_1cm: null, soil_1_3cm: null, soil_3_9cm: null };
  }

  // Calculate averages for the day
  const averages = {
    soil_0_1cm: calculateAverage(
      indices.map((i) => hourlyData.soil_moisture_0_to_1cm[i])
    ),
    soil_1_3cm: calculateAverage(
      indices.map((i) => hourlyData.soil_moisture_1_to_3cm[i])
    ),
    soil_3_9cm: calculateAverage(
      indices.map((i) => hourlyData.soil_moisture_3_to_9cm[i])
    ),
  };

  return averages;
}

/**
 * Calculate average of numeric values, filtering out nulls
 */
function calculateAverage(values: (number | null)[]): number | null {
  const validValues = values.filter((v) => v !== null) as number[];

  if (validValues.length === 0) {
    return null;
  }

  return validValues.reduce((a, b) => a + b, 0) / validValues.length;
}

/**
 * Process OpenMeteO data into aggregated daily records
 * @param weatherData - Raw weather data from OpenMeteO
 * @returns Aggregated daily data records
 */
export function processWeatherData(weatherData: WeatherData): AggregatedData[] {
  const aggregated: AggregatedData[] = [];

  // Process daily records
  weatherData.daily.time.forEach((date, idx) => {
    const soilMoisture = aggregateSoilMoistureToDaily(weatherData.hourly, date);

    const tempMax = weatherData.daily.apparent_temperature_max[idx];
    const tempMin = weatherData.daily.apparent_temperature_min[idx];
    const avgTemp =
      tempMax !== null && tempMin !== null ? (tempMax + tempMin) / 2 : (tempMax ?? tempMin);

    aggregated.push({
      date,
      rainSum: weatherData.daily.rain_sum[idx] || null,
      temperature: avgTemp || null,
      soilMoisture_0_1cm: soilMoisture.soil_0_1cm,
      soilMoisture_1_3cm: soilMoisture.soil_1_3cm,
      soilMoisture_3_9cm: soilMoisture.soil_3_9cm,
    });
  });

  return aggregated;
}

/**
 * Map OpenMeteO soil moisture layers to database schema layers
 * OpenMeteO: 0-1cm, 1-3cm, 3-9cm
 * Database: 7-28cm, 28-100cm, 100-255cm
 * Note: This is a mapping function; calibration may be needed based on your requirements
 */
export function mapSoilMoistureLayers(
  openmeteoData: AggregatedData
): {
  moisture_7_28cm: number | null;
  moisture_28_100cm: number | null;
  moisture_100_255cm: number | null;
} {
  // This is a simplified mapping. You may need to calibrate based on soil science
  // For now, we use weighted averages of surface readings as proxies
  return {
    moisture_7_28cm: openmeteoData.soilMoisture_1_3cm, // Shallow layer proxy
    moisture_28_100cm: calculateAverage([
      openmeteoData.soilMoisture_1_3cm,
      openmeteoData.soilMoisture_3_9cm,
    ]), // Mid layer proxy
    moisture_100_255cm: openmeteoData.soilMoisture_3_9cm, // Deep layer proxy
  };
}
