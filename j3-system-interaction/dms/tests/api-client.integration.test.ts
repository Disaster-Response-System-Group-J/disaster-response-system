import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activityAPI,
  apiRequest,
  incidentsAPI,
  resourcesAPI,
} from '@/lib/api-client';

describe('API integration testing - api-client request layer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('apiRequest sends GET to /api-prefixed endpoint', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    } as Response);

    const response = await apiRequest('/incidents');

    expect(fetchMock).toHaveBeenCalledWith('/api/incidents', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response).toEqual({ status: 'ok' });
  });

  it('apiRequest sends JSON body for non-GET methods', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ updated: true }),
    } as Response);

    await incidentsAPI.updateIncident('INC-5', { status: 'RESOLVED' });

    expect(fetchMock).toHaveBeenCalledWith('/api/incidents/INC-5', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED' }),
    });
  });

  it('throws consistent error when API is not ok', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    await expect(activityAPI.getFeed()).rejects.toThrow(
      'API Error: 500 Internal Server Error',
    );
  });

  it('builds resource filtering endpoint correctly', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ([]),
    } as Response);

    await resourcesAPI.getResourcesByType('AMBULANCE');

    expect(fetchMock).toHaveBeenCalledWith('/api/resources?type=AMBULANCE', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  });
});
