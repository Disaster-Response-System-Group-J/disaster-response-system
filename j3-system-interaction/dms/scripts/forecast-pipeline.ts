import { runForecastPipeline } from "../lib/prediction-pipeline";

async function main() {
  console.log("[forecast-pipeline] Running one-shot forecast + prediction pipeline...");
  await runForecastPipeline();
  process.exit(0);
}

main().catch((err) => {
  console.error("[forecast-pipeline] Fatal error:", err);
  process.exit(1);
});
