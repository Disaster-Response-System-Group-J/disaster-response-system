import { describe, it, expect } from 'vitest';
import { filterIncidents } from '@/lib/filters';
import { MOCK_CONFIRMED_INCIDENTS } from '@/data/mock-data';
import { DISASTER_TYPES, IncidentSeverity, IncidentStatus } from '@/types';

// Mock data counts (derived from MOCK_CONFIRMED_INCIDENTS):
// FLOOD: 5  |  LANDSLIDE: 3  |  OTHER: 0
// CRITICAL: 2  |  HIGH: 3  |  MEDIUM: 2  |  LOW: 1
// ACTIVE: 5  |  UNDER_RESPONSE: 2  |  RESOLVED: 1

describe('filterIncidents — no filter', () => {
  it('returns all incidents when filters object is empty', () => {
    const result = filterIncidents(MOCK_CONFIRMED_INCIDENTS, {});
    expect(result).toHaveLength(MOCK_CONFIRMED_INCIDENTS.length);
  });

  it('returns empty array when input is empty', () => {
    expect(filterIncidents([], { disasterType: DISASTER_TYPES.FLOOD })).toHaveLength(0);
  });
});

describe('filterIncidents — by disaster type', () => {
  it('keeps only FLOOD incidents', () => {
    const result = filterIncidents(MOCK_CONFIRMED_INCIDENTS, { disasterType: DISASTER_TYPES.FLOOD });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(i => i.disasterType === DISASTER_TYPES.FLOOD)).toBe(true);
  });

  it('keeps only LANDSLIDE incidents', () => {
    const result = filterIncidents(MOCK_CONFIRMED_INCIDENTS, { disasterType: DISASTER_TYPES.LANDSLIDE });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(i => i.disasterType === DISASTER_TYPES.LANDSLIDE)).toBe(true);
  });

  it('returns no results for OTHER when no OTHER incidents exist in mock data', () => {
    const result = filterIncidents(MOCK_CONFIRMED_INCIDENTS, { disasterType: DISASTER_TYPES.OTHER });
    expect(result).toHaveLength(0);
  });

  it('FLOOD count is less than total (J3 also has DROUGHT and custom types)', () => {
    const floods = filterIncidents(MOCK_CONFIRMED_INCIDENTS, { disasterType: DISASTER_TYPES.FLOOD }).length;
    expect(floods).toBeGreaterThan(0);
    expect(floods).toBeLessThan(MOCK_CONFIRMED_INCIDENTS.length);
  });
});

describe('filterIncidents — by severity', () => {
  it('keeps only CRITICAL incidents', () => {
    const result = filterIncidents(MOCK_CONFIRMED_INCIDENTS, { severity: IncidentSeverity.CRITICAL });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(i => i.severity === IncidentSeverity.CRITICAL)).toBe(true);
  });

  it('keeps only HIGH incidents', () => {
    const result = filterIncidents(MOCK_CONFIRMED_INCIDENTS, { severity: IncidentSeverity.HIGH });
    expect(result.every(i => i.severity === IncidentSeverity.HIGH)).toBe(true);
  });

  it('keeps only MEDIUM incidents', () => {
    const result = filterIncidents(MOCK_CONFIRMED_INCIDENTS, { severity: IncidentSeverity.MEDIUM });
    expect(result.every(i => i.severity === IncidentSeverity.MEDIUM)).toBe(true);
  });

  it('keeps only LOW incidents', () => {
    const result = filterIncidents(MOCK_CONFIRMED_INCIDENTS, { severity: IncidentSeverity.LOW });
    expect(result.every(i => i.severity === IncidentSeverity.LOW)).toBe(true);
  });
});

describe('filterIncidents — by status', () => {
  it('keeps only ACTIVE incidents', () => {
    const result = filterIncidents(MOCK_CONFIRMED_INCIDENTS, { status: IncidentStatus.ACTIVE });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(i => i.status === IncidentStatus.ACTIVE)).toBe(true);
  });

  it('keeps only UNDER_RESPONSE incidents', () => {
    const result = filterIncidents(MOCK_CONFIRMED_INCIDENTS, { status: IncidentStatus.UNDER_RESPONSE });
    expect(result.every(i => i.status === IncidentStatus.UNDER_RESPONSE)).toBe(true);
  });

  it('keeps only RESOLVED incidents', () => {
    const result = filterIncidents(MOCK_CONFIRMED_INCIDENTS, { status: IncidentStatus.RESOLVED });
    expect(result.every(i => i.status === IncidentStatus.RESOLVED)).toBe(true);
  });
});

describe('filterIncidents — combined filters', () => {
  it('combines disasterType FLOOD and severity CRITICAL', () => {
    const result = filterIncidents(MOCK_CONFIRMED_INCIDENTS, {
      disasterType: DISASTER_TYPES.FLOOD,
      severity: IncidentSeverity.CRITICAL,
    });
    result.forEach(i => {
      expect(i.disasterType).toBe(DISASTER_TYPES.FLOOD);
      expect(i.severity).toBe(IncidentSeverity.CRITICAL);
    });
  });

  it('combines disasterType LANDSLIDE and status UNDER_RESPONSE', () => {
    const result = filterIncidents(MOCK_CONFIRMED_INCIDENTS, {
      disasterType: DISASTER_TYPES.LANDSLIDE,
      status: IncidentStatus.UNDER_RESPONSE,
    });
    result.forEach(i => {
      expect(i.disasterType).toBe(DISASTER_TYPES.LANDSLIDE);
      expect(i.status).toBe(IncidentStatus.UNDER_RESPONSE);
    });
  });

  it('filters by district Colombo', () => {
    const result = filterIncidents(MOCK_CONFIRMED_INCIDENTS, { district: 'Colombo' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(i => i.district === 'Colombo')).toBe(true);
  });

  it('returns empty for non-existent district', () => {
    const result = filterIncidents(MOCK_CONFIRMED_INCIDENTS, { district: 'NonExistentDistrict' });
    expect(result).toHaveLength(0);
  });
});
