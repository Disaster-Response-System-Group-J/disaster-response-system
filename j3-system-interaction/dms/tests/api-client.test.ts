import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('apiRequest', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('calls dashboard endpoints with JSON headers and returns parsed data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ activeIncidents: 3 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { dashboardAPI } = await import('@/lib/api-client');
    const result = await dashboardAPI.getOverview();

    expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/overview', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result).toEqual({ activeIncidents: 3 });
  });

  it('serializes POST request bodies for auth login', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { authAPI } = await import('@/lib/api-client');
    await authAPI.login('admin@example.com', 'secret');

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', passkey: 'secret' }),
    });
  });

  it('throws a useful error when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }));

    const { apiRequest } = await import('@/lib/api-client');

    await expect(apiRequest('/incidents')).rejects.toThrow('API Error: 500 Internal Server Error');
  });
});
