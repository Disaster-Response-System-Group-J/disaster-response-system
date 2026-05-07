import { computeAndSaveFeatures } from "../lib/compute-features";

async function main() {
  console.log("[compute-features] Computing ML features for all divisions...");
  const results = await computeAndSaveFeatures();
  console.log(`\n[compute-features] Done. Success: ${results.success}, Failed: ${results.failed}`);
  process.exit(results.failed > 0 ? 1 : 0);
}

main();
