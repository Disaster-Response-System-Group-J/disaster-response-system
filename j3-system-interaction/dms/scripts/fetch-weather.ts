import { fetchAndSaveWeatherForAllDivisions } from "../lib/weather-scheduler";

async function main() {
  console.log("[fetch-weather] Fetching last 7 days of weather data for all divisions...");
  const results = await fetchAndSaveWeatherForAllDivisions(7);
  console.log(`\n[fetch-weather] Done. Success: ${results.success}, Failed: ${results.failed}`);
  if (results.errors.length > 0) {
    console.error("[fetch-weather] Errors:", results.errors);
  }
  process.exit(results.failed > 0 ? 1 : 0);
}

main();
