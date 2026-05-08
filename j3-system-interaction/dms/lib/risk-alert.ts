import { IncidentSeverity } from '@/types';

export type NormalizedRiskAlert = {
  alertId: string;
  title: string;
  severity: string;
  district: string;
  description: string;
  createdAt: string;
  source: string;
  isActive: boolean;
  isPublic: boolean;
  predictionCategory?: string;
  predictionProbability?: number;
  considerationScore?: number;
  predictionKind?: string;
  forecastDate?: string;
  divisionName?: string;
  topProbabilityKey?: string;
  probabilities?: Record<string, number>;
};

const asNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
};

export function normalizeRiskAlert(alert: any): NormalizedRiskAlert {
  const payload = alert?.payload ?? alert ?? {};
  const probabilities = payload.probabilities ?? alert?.probabilities ?? {};
  const probabilityValues = Object.values(probabilities).map(asNumber).filter((value): value is number => typeof value === 'number');

  const predictionProbability = asNumber(payload.predictionProbability ?? alert?.predictionProbability)
    ?? (probabilityValues.length ? Math.max(...probabilityValues) : undefined);
  const considerationScore = asNumber(payload.considerationScore ?? alert?.considerationScore);

  return {
    alertId: asString(payload.alertId ?? alert?.alertId ?? alert?.id ?? `risk-${Date.now()}`),
    title: asString(payload.title ?? alert?.title ?? 'Risk Alert'),
    severity: asString(payload.severity ?? alert?.severity ?? alert?.severity_level ?? IncidentSeverity.HIGH),
    district: asString(payload.district ?? alert?.district ?? 'National'),
    description: asString(payload.description ?? alert?.description ?? ''),
    createdAt: asString(alert?.timestamp ?? payload.createdAt ?? alert?.createdAt ?? new Date().toISOString()),
    source: asString(alert?.source ?? payload.source ?? 'Kafka / J2 Engine'),
    isActive: Boolean(alert?.isActive ?? payload.isActive ?? true),
    isPublic: Boolean(alert?.isPublic ?? payload.isPublic ?? false),
    predictionCategory: asString(payload.predictionCategory ?? alert?.predictionCategory ?? payload.hazardType ?? alert?.hazardType ?? ''),
    predictionProbability,
    considerationScore,
    predictionKind: asString(payload.predictionKind ?? alert?.predictionKind ?? ''),
    forecastDate: asString(payload.forecastDate ?? alert?.forecastDate ?? ''),
    divisionName: asString(payload.divisionName ?? alert?.divisionName ?? ''),
    topProbabilityKey: asString(payload.topProbabilityKey ?? alert?.topProbabilityKey ?? ''),
    probabilities: Object.keys(probabilities).length ? probabilities : undefined,
  };
}