/**
 * Shared SPI (Standardised Precipitation Index) utilities.
 * Mirrors the Python compute_spi() in temporal_split_pipeline.py exactly.
 */

// ── Gamma distribution helpers ───────────────────────────────────────────────

function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function digamma(x: number): number {
  if (x < 6) return digamma(x + 1) - 1 / x;
  const x2 = x * x;
  return (
    Math.log(x) -
    1 / (2 * x) -
    1 / (12 * x2) +
    1 / (120 * x2 * x2) -
    1 / (252 * x2 * x2 * x2)
  );
}

function trigamma(x: number): number {
  if (x < 6) return trigamma(x + 1) + 1 / (x * x);
  const x2 = x * x;
  return (
    1 / x +
    1 / (2 * x2) +
    1 / (6 * x2 * x) -
    1 / (30 * x2 * x2 * x) +
    1 / (42 * x2 * x2 * x2 * x)
  );
}

function regularizedGammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let term = 1 / a, sum = term;
    for (let n = 1; n <= 300; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-12 * Math.abs(sum)) break;
    }
    return Math.exp(-x + a * Math.log(x) - logGamma(a)) * sum;
  }
  const FPMIN = 1e-300;
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i <= 300; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-12) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

export function fitGamma(data: number[]): { shape: number; scale: number } | null {
  if (data.length < 2) return null;
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const meanLog = data.reduce((a, b) => a + Math.log(b), 0) / n;
  const s = Math.log(mean) - meanLog;
  if (s <= 0) return null;

  let shape = (3 - s + Math.sqrt((s - 3) ** 2 + 24 * s)) / (12 * s);
  for (let i = 0; i < 50; i++) {
    const delta =
      (Math.log(shape) - digamma(shape) - s) / (1 / shape - trigamma(shape));
    shape -= delta;
    if (!isFinite(shape) || shape <= 0) return null;
    if (Math.abs(delta) < 1e-8) break;
  }
  return { shape, scale: mean / shape };
}

// Peter Acklam's rational approximation for normal inverse CDF
export function normalPPF(p: number): number {
  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
     1.383577518672690e+02, -3.066479806614716e+01,  2.506628277459239e+00,
  ];
  const b = [
    -5.447609879822406e+01,  1.615858368580409e+02, -1.556989798598866e+02,
     6.680131188771972e+01, -1.328068155288572e+01,
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
    -2.549732539343734e+00,  4.374664141464968e+00,  2.938163982698783e+00,
  ];
  const d = [
     7.784695709041462e-03,  3.224671290700398e-01,
     2.445134137142996e+00,  3.754408661907416e+00,
  ];
  const pLow = 0.02425, pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    const q = p - 0.5, r = q * q;
    return (
      (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

/**
 * Compute SPI for every value in the series.
 * Matches temporal_split_pipeline.py compute_spi() exactly.
 */
export function computeSPI(rainValues: (number | null)[]): (number | null)[] {
  const valid = rainValues.filter((v) => v !== null) as number[];
  if (valid.length === 0) return rainValues.map(() => null);

  const q = valid.filter((v) => v === 0).length / valid.length;
  const nonZeros = valid.filter((v) => v > 0);
  const fit = nonZeros.length > 1 ? fitGamma(nonZeros) : null;

  return rainValues.map((v) => {
    if (v === null || fit === null) return null;
    const cdf = regularizedGammaP(fit.shape, v / fit.scale);
    const hx = Math.min(Math.max(q + (1 - q) * cdf, 0.0001), 0.9999);
    return Math.round(normalPPF(hx) * 1000) / 1000;
  });
}

/**
 * Compute SPI for a set of target values using a pre-fitted distribution
 * from a separate reference series. Used for applying historical gamma fit
 * to forecast rain values.
 */
export function computeSPIWithReference(
  referenceRain: (number | null)[],
  targetRain: (number | null)[]
): (number | null)[] {
  const refValid = referenceRain.filter((v) => v !== null) as number[];
  if (refValid.length === 0) return targetRain.map(() => null);

  const q = refValid.filter((v) => v === 0).length / refValid.length;
  const nonZeros = refValid.filter((v) => v > 0);
  const fit = nonZeros.length > 1 ? fitGamma(nonZeros) : null;

  return targetRain.map((v) => {
    if (v === null || fit === null) return null;
    const cdf = regularizedGammaP(fit.shape, v / fit.scale);
    const hx = Math.min(Math.max(q + (1 - q) * cdf, 0.0001), 0.9999);
    return Math.round(normalPPF(hx) * 1000) / 1000;
  });
}
