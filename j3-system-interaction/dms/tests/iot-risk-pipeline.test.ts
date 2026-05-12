import { describe, expect, it } from 'vitest';
import {
  attachLevelDifferences,
  buildComputedFeatureRecord,
  buildKafkaRiskAlert,
  calculateLevelDifference,
  mapSeverityLabelToRiskLevel,
  normalizePredictionRows,
} from '@/lib/iot-risk-pipeline';

describe('calculateLevelDifference', () => {
  it('returns the current minus previous level', () => {
    expect(calculateLevelDifference(0.44, 0.62)).toBe(0.18);
  });

  it('returns null for the first reading', () => {
    expect(calculateLevelDifference(null, 0.62)).toBeNull();
  });
});

describe('attachLevelDifferences', () => {
  it('computes sequential differences per device', () => {
    const enriched = attachLevelDifferences([
      {
        rowId: 1,
        deviceId: 'DEV-001',
        sensorType: 'FLOOD',
        temp: 29.1,
        hum: 71.2,
        depth: 0.44,
        recordedAt: '2026-05-11T00:00:00.000Z',
      },
      {
        rowId: 2,
        deviceId: 'DEV-001',
        sensorType: 'FLOOD',
        temp: 29.4,
        hum: 70.1,
        depth: 0.62,
        recordedAt: '2026-05-11T00:10:00.000Z',
      },
    ]);

    expect(enriched[0].levelDifference).toBeNull();
    expect(enriched[1].levelDifference).toBe(0.18);
  });
});

describe('buildComputedFeatureRecord', () => {
  it('uses rainfall history to build rolling features and SPI', () => {
    const record = buildComputedFeatureRecord({
      divisionId: 1,
      divisionEncoded: 12,
      divisionName: 'Ududumbara',
      featureDate: '2026-05-11T00:00:00.000Z',
      rainfallHistory: [10, 20, 30, 40],
      levelDifference: 0.18,
    });

    expect(record.divisionId).toBe(1);
    expect(record.rainLag1).toBe(30);
    expect(record.rainRolling3d).toBe(90);
    expect(record.rainRolling7d).toBeNull();
    expect(record.levelDifference).toBe(0.18);
  });
});

describe('buildKafkaRiskAlert', () => {
  it('selects the dominant horizon-1 hazard and exposes a normalized alert payload', () => {
    const alert = buildKafkaRiskAlert({
      division: {
        divisionId: 1,
        divisionName: 'Ududumbara',
        district: 'Kandy',
        population: 500000,
        latitude: 7.3,
        longitude: 80.8333,
        divisionEncoded: 12,
      },
      featureDate: '2026-05-11',
      predictions: normalizePredictionRows([
        {
          division_id: 1,
          division_name: 'Ududumbara',
          district: 'Kandy',
          feature_date: '2026-05-11',
          predicted_for_date: '2026-05-12',
          horizon: 1,
          hazard_type: 'FLOOD',
          prob_normal: 0.05,
          prob_moderate: 0.15,
          prob_severe: 0.45,
          prob_extreme: 0.35,
          predicted_severity: 3,
          predicted_severity_label: 'Extreme',
        },
        {
          division_id: 1,
          division_name: 'Ududumbara',
          district: 'Kandy',
          feature_date: '2026-05-11',
          predicted_for_date: '2026-05-12',
          horizon: 1,
          hazard_type: 'LANDSLIDE',
          prob_normal: 0.60,
          prob_moderate: 0.20,
          prob_severe: 0.10,
          prob_extreme: 0.10,
          predicted_severity: 0,
          predicted_severity_label: 'Normal',
        },
      ] as any),
    });

    expect(alert.payload.predictionCategory).toBe('FLOOD');
    expect(alert.payload.severity).toBe('CRITICAL');
    expect(alert.payload.predictionProbability).toBeCloseTo(0.8, 4);
    expect(alert.payload.district).toBe('Kandy');
  });
});

describe('mapSeverityLabelToRiskLevel', () => {
  it('maps model labels to dashboard severity levels', () => {
    expect(mapSeverityLabelToRiskLevel('Extreme')).toBe('CRITICAL');
    expect(mapSeverityLabelToRiskLevel('Severe')).toBe('HIGH');
    expect(mapSeverityLabelToRiskLevel('Moderate')).toBe('MEDIUM');
    expect(mapSeverityLabelToRiskLevel('Normal')).toBe('LOW');
  });
});