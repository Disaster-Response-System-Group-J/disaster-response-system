import { describe, it, expect } from 'vitest';
import {
  getActiveIncidentCount,
  getCriticalIncidentCount,
  getHighSeverityIncidentCount,
  getAvailableResourceCount,
  getPendingReportCount,
  getTotalAffectedPeople,
} from '@/lib/stats';
import {
  MOCK_CONFIRMED_INCIDENTS,
  MOCK_RESOURCES,
  MOCK_INCOMING_REPORTS,
} from '@/data/mock-data';
import { IncidentStatus, IncidentSeverity, ResourceStatus, VerificationStatus } from '@/types';
import type { ConfirmedIncident, Resource } from '@/types';

describe('getActiveIncidentCount', () => {
  it('returns correct count of ACTIVE incidents from mock data', () => {
    const count = getActiveIncidentCount(MOCK_CONFIRMED_INCIDENTS);
    const expected = MOCK_CONFIRMED_INCIDENTS.filter(i => i.status === IncidentStatus.ACTIVE).length;
    expect(count).toBe(expected);
  });

  it('returns a value greater than zero (mock data has active incidents)', () => {
    expect(getActiveIncidentCount(MOCK_CONFIRMED_INCIDENTS)).toBeGreaterThan(0);
  });

  it('returns 0 for empty array', () => {
    expect(getActiveIncidentCount([])).toBe(0);
  });

  it('returns 0 when all incidents are RESOLVED', () => {
    const allResolved = MOCK_CONFIRMED_INCIDENTS.map(i => ({
      ...i,
      status: IncidentStatus.RESOLVED,
    }));
    expect(getActiveIncidentCount(allResolved)).toBe(0);
  });

  it('counts only active, not UNDER_RESPONSE or RESOLVED', () => {
    const mix: ConfirmedIncident[] = [
      { ...MOCK_CONFIRMED_INCIDENTS[0], status: IncidentStatus.ACTIVE },
      { ...MOCK_CONFIRMED_INCIDENTS[1], status: IncidentStatus.UNDER_RESPONSE },
      { ...MOCK_CONFIRMED_INCIDENTS[2], status: IncidentStatus.RESOLVED },
    ];
    expect(getActiveIncidentCount(mix)).toBe(1);
  });
});

describe('getCriticalIncidentCount', () => {
  it('returns correct count of CRITICAL incidents from mock data', () => {
    const count = getCriticalIncidentCount(MOCK_CONFIRMED_INCIDENTS);
    const expected = MOCK_CONFIRMED_INCIDENTS.filter(i => i.severity === IncidentSeverity.CRITICAL).length;
    expect(count).toBe(expected);
  });

  it('returns 0 for empty array', () => {
    expect(getCriticalIncidentCount([])).toBe(0);
  });

  it('is less than or equal to total incident count', () => {
    expect(getCriticalIncidentCount(MOCK_CONFIRMED_INCIDENTS)).toBeLessThanOrEqual(
      MOCK_CONFIRMED_INCIDENTS.length,
    );
  });
});

describe('getHighSeverityIncidentCount', () => {
  it('counts HIGH and CRITICAL incidents together', () => {
    const count = getHighSeverityIncidentCount(MOCK_CONFIRMED_INCIDENTS);
    const expected = MOCK_CONFIRMED_INCIDENTS.filter(
      i => i.severity === IncidentSeverity.HIGH || i.severity === IncidentSeverity.CRITICAL,
    ).length;
    expect(count).toBe(expected);
  });

  it('is always >= getCriticalIncidentCount', () => {
    expect(getHighSeverityIncidentCount(MOCK_CONFIRMED_INCIDENTS)).toBeGreaterThanOrEqual(
      getCriticalIncidentCount(MOCK_CONFIRMED_INCIDENTS),
    );
  });

  it('returns 0 for empty array', () => {
    expect(getHighSeverityIncidentCount([])).toBe(0);
  });
});

describe('getAvailableResourceCount', () => {
  it('returns correct count of AVAILABLE resources from mock data', () => {
    const count = getAvailableResourceCount(MOCK_RESOURCES);
    const expected = MOCK_RESOURCES.filter(r => r.status === ResourceStatus.AVAILABLE).length;
    expect(count).toBe(expected);
  });

  it('returns 0 for empty array', () => {
    expect(getAvailableResourceCount([])).toBe(0);
  });

  it('does not count ASSIGNED resources', () => {
    const allAssigned: Resource[] = MOCK_RESOURCES.map(r => ({ ...r, status: ResourceStatus.ASSIGNED }));
    expect(getAvailableResourceCount(allAssigned)).toBe(0);
  });

  it('does not count BUSY resources', () => {
    const allBusy: Resource[] = MOCK_RESOURCES.map(r => ({ ...r, status: ResourceStatus.BUSY }));
    expect(getAvailableResourceCount(allBusy)).toBe(0);
  });

  it('counts all when all resources are AVAILABLE', () => {
    const allAvailable: Resource[] = MOCK_RESOURCES.map(r => ({ ...r, status: ResourceStatus.AVAILABLE }));
    expect(getAvailableResourceCount(allAvailable)).toBe(MOCK_RESOURCES.length);
  });
});

describe('getPendingReportCount', () => {
  it('returns correct count of PENDING_REVIEW reports from mock data', () => {
    const count = getPendingReportCount(MOCK_INCOMING_REPORTS);
    const expected = MOCK_INCOMING_REPORTS.filter(
      r => r.verificationStatus === VerificationStatus.PENDING_REVIEW,
    ).length;
    expect(count).toBe(expected);
  });

  it('returns a value greater than zero (mock data has pending reports)', () => {
    expect(getPendingReportCount(MOCK_INCOMING_REPORTS)).toBeGreaterThan(0);
  });

  it('returns 0 for empty array', () => {
    expect(getPendingReportCount([])).toBe(0);
  });
});

describe('getTotalAffectedPeople', () => {
  it('sums affectedPeople correctly across all mock incidents', () => {
    const total = getTotalAffectedPeople(MOCK_CONFIRMED_INCIDENTS);
    const expected = MOCK_CONFIRMED_INCIDENTS.reduce((sum, i) => sum + (i.affectedPeople ?? 0), 0);
    expect(total).toBe(expected);
  });

  it('returns a positive number for mock data', () => {
    expect(getTotalAffectedPeople(MOCK_CONFIRMED_INCIDENTS)).toBeGreaterThan(0);
  });

  it('returns 0 for empty array', () => {
    expect(getTotalAffectedPeople([])).toBe(0);
  });

  it('handles incidents with undefined affectedPeople (treats as 0)', () => {
    const incidents: ConfirmedIncident[] = [
      { ...MOCK_CONFIRMED_INCIDENTS[0], affectedPeople: undefined },
      { ...MOCK_CONFIRMED_INCIDENTS[1], affectedPeople: 100 },
    ];
    expect(getTotalAffectedPeople(incidents)).toBe(100);
  });
});
