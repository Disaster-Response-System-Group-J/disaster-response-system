import { computeSPI } from './spi';

export interface DivisionContext {
  divisionId: number;
  divisionName: string;
  district: string | null;
  population: number | null;
  latitude: number | null;
  longitude: number | null;
  divisionEncoded: number | null;
}

export interface IoTRainfallReading {
  rowId?: number;
  deviceId: string;
  sensorType: string;
  temp: number | null;
  hum: number | null;
  depth: number | null;
  recordedAt: string | Date;
}

export interface WeatherSnapshot {
  rainSum: number | null;
  temperature: number | null;
  soilMoisture7_28cm: number | null;
  soilMoisture28_100cm: number | null;
  soilMoisture100_255cm: number | null;
}

export interface ComputedFeatureRecord {
  divisionId: number;
  date: string;
  rainLag1: number | null;
  rainRolling3d: number | null;
  rainRolling7d: number | null;
  monthSin: number | null;
  monthCos: number | null;
  spi: number | null;
  divisionEncoded: number | null;
  levelDifference: number | null;
}

export interface PredictionRecord {
  division_id: number;
  division_name: string;
  district: string;
  feature_date: string;
  predicted_for_date: string;
  horizon: number;
  hazard_type: string;
  prob_normal: number | null;
  prob_moderate: number | null;
  prob_severe: number | null;
  prob_extreme: number | null;
  predicted_severity: number | null;
  predicted_severity_label: string | null;
}

export interface KafkaRiskAlert {
  eventId: string;
  eventType: 'risk-alert';
  timestamp: string;
  payload: {
    alertId: string;
    type: 'RISK_ALERT';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    title: string;
    description: string;
    district: string;
    divisionId: number;
    divisionName: string;
    forecastDate: string;
    predictionKind: 'severity';
    predictionCategory: string;
    predictionProbability: number;
    topProbabilityKey: string;
    probabilities: Record<string, number>;
    considerationScore: number;
    resourcePressure: number;
    hazardType: string;
    predictedSeverityLabel: string | null;
    featureDate: string;
    source: string;
    isActive: boolean;
    isPublic: boolean;
  };
}

export function toDateOnly(value: string | Date): string {
  const dateValue = value instanceof Date ? value : new Date(value);
  return dateValue.toISOString().slice(0, 10);
}

export function toUtcDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function sumLast(values: Array<number | null>, count: number): number | null {
  if (values.length < count) {
    return null;
  }

  return values.slice(values.length - count).reduce<number>((sum, entry) => sum + (entry ?? 0), 0);
}

export function calculateLevelDifference(previousLevel: number | null | undefined, currentLevel: number | null | undefined): number | null {
  if (previousLevel === null || previousLevel === undefined) {
    return null;
  }

  if (currentLevel === null || currentLevel === undefined) {
    return null;
  }

  return Number((currentLevel - previousLevel).toFixed(4));
}

export function attachLevelDifferences(readings: IoTRainfallReading[]): Array<IoTRainfallReading & { levelDifference: number | null }> {
  const grouped = new Map<string, IoTRainfallReading[]>();

  for (const reading of readings) {
    const deviceReadings = grouped.get(reading.deviceId) ?? [];
    deviceReadings.push(reading);
    grouped.set(reading.deviceId, deviceReadings);
  }

  const enriched: Array<IoTRainfallReading & { levelDifference: number | null }> = [];

  for (const deviceReadings of grouped.values()) {
    const ordered = [...deviceReadings].sort((left, right) => {
      const leftTime = toUtcDate(left.recordedAt).getTime();
      const rightTime = toUtcDate(right.recordedAt).getTime();

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return (left.rowId ?? 0) - (right.rowId ?? 0);
    });

    let previousLevel: number | null = null;
    for (const reading of ordered) {
      const currentLevel = reading.depth;
      enriched.push({
        ...reading,
        levelDifference: calculateLevelDifference(previousLevel, currentLevel),
      });
      previousLevel = currentLevel;
    }
  }

  return enriched.sort((left, right) => {
    const leftTime = toUtcDate(left.recordedAt).getTime();
    const rightTime = toUtcDate(right.recordedAt).getTime();

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return (left.rowId ?? 0) - (right.rowId ?? 0);
  });
}

export function buildComputedFeatureRecord(params: {
  divisionId: number;
  divisionEncoded: number | null;
  divisionName: string;
  featureDate: string | Date;
  rainfallHistory: Array<number | null>;
  levelDifference: number | null;
}): ComputedFeatureRecord {
  const featureDate = toUtcDate(params.featureDate);
  const rainfallValues = params.rainfallHistory;
  const spiSeries = computeSPI(rainfallValues);
  const currentIndex = Math.max(rainfallValues.length - 1, 0);
  const month = featureDate.getUTCMonth() + 1;

  return {
    divisionId: params.divisionId,
    date: toDateOnly(featureDate),
    rainLag1: currentIndex >= 1 ? rainfallValues[currentIndex - 1] : null,
    rainRolling3d: sumLast(rainfallValues, 3),
    rainRolling7d: sumLast(rainfallValues, 7),
    monthSin: Number(Math.sin((2 * Math.PI * month) / 12).toFixed(6)),
    monthCos: Number(Math.cos((2 * Math.PI * month) / 12).toFixed(6)),
    spi: spiSeries[currentIndex] ?? null,
    divisionEncoded: params.divisionEncoded,
    levelDifference: params.levelDifference,
  };
}

export function severityLabelFromProbability(probability: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (probability >= 0.75) {
    return 'CRITICAL';
  }

  if (probability >= 0.5) {
    return 'HIGH';
  }

  if (probability >= 0.3) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function crisisProbability(row: PredictionRecord): number {
  return (row.prob_severe ?? 0) + (row.prob_extreme ?? 0);
}

function topSeverityKey(row: PredictionRecord): string {
  const probabilities: Array<[string, number]> = [
    ['NORMAL', row.prob_normal ?? 0],
    ['MODERATE', row.prob_moderate ?? 0],
    ['SEVERE', row.prob_severe ?? 0],
    ['EXTREME', row.prob_extreme ?? 0],
  ];

  return probabilities.sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'NORMAL';
}

export function buildKafkaRiskAlert(params: {
  division: DivisionContext;
  featureDate: string;
  predictions: PredictionRecord[];
}): KafkaRiskAlert {
  const horizonOneRows = params.predictions.filter((row) => row.horizon === 1);

  if (horizonOneRows.length === 0) {
    throw new Error('No horizon 1 prediction rows supplied to buildKafkaRiskAlert');
  }

  const dominant = [...horizonOneRows].sort((left, right) => crisisProbability(right) - crisisProbability(left))[0];
  const dominantProbability = crisisProbability(dominant);
  const severity = severityLabelFromProbability(dominantProbability);
  const populationFactor = Math.min((params.division.population ?? 0) / 1000000, 1);
  const considerationScore = Number(Math.min(1, dominantProbability * populationFactor).toFixed(4));

  return {
    eventId: `iot-risk-${params.division.divisionId}-${params.featureDate}-${Date.now()}`,
    eventType: 'risk-alert',
    timestamp: new Date().toISOString(),
    payload: {
      alertId: `ALT-IOT-${params.division.divisionId}-${params.featureDate}`,
      type: 'RISK_ALERT',
      severity,
      title: `${severity} ${dominant.hazard_type} Watch for ${params.division.divisionName}`,
      description: `Synthetic IoT-driven risk alert for ${params.division.divisionName}. Dominant hazard: ${dominant.hazard_type}.`,
      district: params.division.district || params.division.divisionName,
      divisionId: params.division.divisionId,
      divisionName: params.division.divisionName,
      forecastDate: dominant.predicted_for_date,
      predictionKind: 'severity',
      predictionCategory: dominant.hazard_type,
      predictionProbability: Number(dominantProbability.toFixed(4)),
      topProbabilityKey: topSeverityKey(dominant),
      probabilities: {
        NORMAL: dominant.prob_normal ?? 0,
        MODERATE: dominant.prob_moderate ?? 0,
        SEVERE: dominant.prob_severe ?? 0,
        EXTREME: dominant.prob_extreme ?? 0,
      },
      considerationScore,
      resourcePressure: 0,
      hazardType: dominant.hazard_type,
      predictedSeverityLabel: dominant.predicted_severity_label,
      featureDate: params.featureDate,
      source: 'J3 IoT Risk Pipeline',
      isActive: true,
      isPublic: false,
    },
  };
}

export function mapSeverityLabelToRiskLevel(label: string | null | undefined): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const normalized = (label || '').toLowerCase();

  if (normalized === 'extreme') {
    return 'CRITICAL';
  }

  if (normalized === 'severe') {
    return 'HIGH';
  }

  if (normalized === 'moderate') {
    return 'MEDIUM';
  }

  return 'LOW';
}

export function normalizePredictionRows(rows: PredictionRecord[]): Array<PredictionRecord & { riskLevel: string; score: number }> {
  return rows.map((row) => ({
    ...row,
    riskLevel: mapSeverityLabelToRiskLevel(row.predicted_severity_label),
    score: Number(((row.prob_severe ?? 0) + (row.prob_extreme ?? 0)).toFixed(4)),
  }));
}