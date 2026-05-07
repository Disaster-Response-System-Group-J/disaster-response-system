/**
 * Daily Prediction Pipeline
 * Orchestrates the three-step daily cycle:
 *   1. Fetch 3-day forecast weather → forecast_weather_data
 *   2. Compute engineered features  → forecast_features
 *   3. Run Python ML models         → disaster_predictions
 *
 * A lightweight `setTimeout`-based scheduler fires once per day at the
 * configured UTC time and re-queues itself for the following day.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

import { fetchForecastForAllDivisions } from "./forecast-fetch";
import { computeAndSaveForecastFeatures } from "./forecast-features";

const execFileAsync = promisify(execFile);

const FORECAST_DAYS = 3;

// ── Python inference ─────────────────────────────────────────────────────────

async function runPythonPredictions(): Promise<void> {
  const scriptPath = path.join(process.cwd(), "scripts", "run-predictions.py");

  const { stdout, stderr } = await execFileAsync("python3", [scriptPath], {
    env: process.env,
    timeout: 5 * 60 * 1000, // 5-minute hard timeout
  });

  if (stdout) console.log(stdout);
  if (stderr) console.error("[Pipeline] Python stderr:", stderr);
}

// ── Full pipeline ─────────────────────────────────────────────────────────────

export async function runForecastPipeline(): Promise<void> {
  const started = Date.now();
  console.log("[Pipeline] ── Starting daily forecast pipeline ──");

  // Step 1
  console.log(`[Pipeline] Step 1/3 — Fetching ${FORECAST_DAYS}-day forecast weather...`);
  const fetchRes = await fetchForecastForAllDivisions(FORECAST_DAYS);
  console.log(
    `[Pipeline] Step 1/3 done — ${fetchRes.success} OK, ${fetchRes.failed} failed`
  );

  // Step 2
  console.log("[Pipeline] Step 2/3 — Computing forecast features...");
  const featRes = await computeAndSaveForecastFeatures();
  console.log(
    `[Pipeline] Step 2/3 done — ${featRes.success} OK, ${featRes.failed} failed`
  );

  // Step 3
  console.log("[Pipeline] Step 3/3 — Running ML predictions (Python)...");
  await runPythonPredictions();
  console.log("[Pipeline] Step 3/3 done");

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[Pipeline] ── Pipeline complete in ${elapsed}s ──`);
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

function msUntilNextRun(hours: number, minutes: number): number {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(hours, minutes, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

/**
 * Schedule the daily prediction pipeline.
 * Uses recursive setTimeout so the next run is always calculated fresh
 * (avoids drift from setInterval).
 *
 * @param scheduleTime  24-h UTC time string, e.g. "03:00"
 */
export function scheduleDailyPredictionPipeline(
  scheduleTime: string = "03:00"
): void {
  const [hours, minutes] = scheduleTime.split(":").map(Number);

  if (
    isNaN(hours) || isNaN(minutes) ||
    hours < 0 || hours > 23 ||
    minutes < 0 || minutes > 59
  ) {
    throw new Error(
      `Invalid schedule time "${scheduleTime}". Use HH:MM (24-hour UTC).`
    );
  }

  function scheduleNext() {
    const delay = msUntilNextRun(hours, minutes);
    const nextRun = new Date(Date.now() + delay).toISOString();
    console.log(`[Pipeline] Next run scheduled at ${nextRun} (in ${Math.round(delay / 60000)} min)`);

    setTimeout(async () => {
      try {
        await runForecastPipeline();
      } catch (err) {
        console.error("[Pipeline] Daily run failed:", err);
      }
      scheduleNext(); // queue next day
    }, delay);
  }

  scheduleNext();
  console.log(
    `[Pipeline] Daily prediction pipeline scheduled at ${scheduleTime} UTC`
  );
}
