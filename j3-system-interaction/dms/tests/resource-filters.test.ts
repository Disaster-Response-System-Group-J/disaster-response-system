import { describe, it, expect } from 'vitest';
import { filterResources } from '@/lib/filters';
import { MOCK_RESOURCES } from '@/data/mock-data';
import { ResourceType, ResourceStatus } from '@/types';

// Mock data counts (derived from MOCK_RESOURCES):
// AVAILABLE: 2  |  ASSIGNED: 7  |  BUSY: 2  |  OUT_OF_SERVICE: 1

describe('filterResources — no filter', () => {
  it('returns all resources when filters object is empty', () => {
    expect(filterResources(MOCK_RESOURCES, {})).toHaveLength(MOCK_RESOURCES.length);
  });

  it('returns empty array when input is empty', () => {
    expect(filterResources([], { status: ResourceStatus.AVAILABLE })).toHaveLength(0);
  });
});

describe('filterResources — by type', () => {
  it('keeps only RESCUE_TEAM resources', () => {
    const result = filterResources(MOCK_RESOURCES, { type: ResourceType.RESCUE_TEAM });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(r => r.type === ResourceType.RESCUE_TEAM)).toBe(true);
  });

  it('keeps only AMBULANCE resources', () => {
    const result = filterResources(MOCK_RESOURCES, { type: ResourceType.AMBULANCE });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(r => r.type === ResourceType.AMBULANCE)).toBe(true);
  });

  it('keeps only SHELTER resources', () => {
    const result = filterResources(MOCK_RESOURCES, { type: ResourceType.SHELTER });
    expect(result.every(r => r.type === ResourceType.SHELTER)).toBe(true);
  });

  it('keeps only BOAT resources', () => {
    const result = filterResources(MOCK_RESOURCES, { type: ResourceType.BOAT });
    expect(result.every(r => r.type === ResourceType.BOAT)).toBe(true);
  });
});

describe('filterResources — by status', () => {
  it('keeps only AVAILABLE resources', () => {
    const result = filterResources(MOCK_RESOURCES, { status: ResourceStatus.AVAILABLE });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(r => r.status === ResourceStatus.AVAILABLE)).toBe(true);
  });

  it('keeps only ASSIGNED resources', () => {
    const result = filterResources(MOCK_RESOURCES, { status: ResourceStatus.ASSIGNED });
    expect(result.every(r => r.status === ResourceStatus.ASSIGNED)).toBe(true);
  });

  it('keeps only BUSY resources', () => {
    const result = filterResources(MOCK_RESOURCES, { status: ResourceStatus.BUSY });
    expect(result.every(r => r.status === ResourceStatus.BUSY)).toBe(true);
  });

  it('keeps only OUT_OF_SERVICE resources', () => {
    const result = filterResources(MOCK_RESOURCES, { status: ResourceStatus.OUT_OF_SERVICE });
    expect(result.every(r => r.status === ResourceStatus.OUT_OF_SERVICE)).toBe(true);
  });

  it('available count matches expected value from mock data', () => {
    const result = filterResources(MOCK_RESOURCES, { status: ResourceStatus.AVAILABLE });
    const expected = MOCK_RESOURCES.filter(r => r.status === ResourceStatus.AVAILABLE).length;
    expect(result).toHaveLength(expected);
  });
});

describe('filterResources — by district', () => {
  it('keeps only resources in Ratnapura', () => {
    const result = filterResources(MOCK_RESOURCES, { district: 'Ratnapura' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(r => r.district === 'Ratnapura')).toBe(true);
  });

  it('returns empty for a district with no resources', () => {
    const result = filterResources(MOCK_RESOURCES, { district: 'Jaffna' });
    expect(result).toHaveLength(0);
  });
});

describe('filterResources — by search', () => {
  it('finds resources by name (case-insensitive)', () => {
    const result = filterResources(MOCK_RESOURCES, { search: 'ambulance' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(r => r.name.toLowerCase().includes('ambulance'))).toBe(true);
  });

  it('finds a resource by its exact ID', () => {
    const result = filterResources(MOCK_RESOURCES, { search: 'RSC-001' });
    expect(result).toHaveLength(1);
    expect(result[0].resourceId).toBe('RSC-001');
  });

  it('returns empty when search matches nothing', () => {
    const result = filterResources(MOCK_RESOURCES, { search: 'xxxxxnonexistent' });
    expect(result).toHaveLength(0);
  });
});

describe('filterResources — combined filters', () => {
  it('combines type AMBULANCE and status AVAILABLE', () => {
    const result = filterResources(MOCK_RESOURCES, {
      type: ResourceType.AMBULANCE,
      status: ResourceStatus.AVAILABLE,
    });
    result.forEach(r => {
      expect(r.type).toBe(ResourceType.AMBULANCE);
      expect(r.status).toBe(ResourceStatus.AVAILABLE);
    });
  });

  it('combines district and status filters', () => {
    const result = filterResources(MOCK_RESOURCES, {
      district: 'Ratnapura',
      status: ResourceStatus.ASSIGNED,
    });
    result.forEach(r => {
      expect(r.district).toBe('Ratnapura');
      expect(r.status).toBe(ResourceStatus.ASSIGNED);
    });
  });
});
