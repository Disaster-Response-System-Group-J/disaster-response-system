import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('@/lib/db', () => ({
  pool: { query: queryMock },
}));

describe('GET /api/dashboard/overview', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('returns parsed dashboard counts from the database', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ count: '4' }] })
      .mockResolvedValueOnce({ rows: [{ count: '9' }] })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] });

    const { GET } = await import('@/app/api/dashboard/overview/route');
    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      activeIncidents: 4,
      availableResources: 9,
      openShelters: 2,
    });
    expect(response.status).toBe(200);
    expect(queryMock).toHaveBeenCalledTimes(3);
  });

  it('returns a 500 response when the database query fails', async () => {
    queryMock.mockRejectedValue(new Error('database down'));

    const { GET } = await import('@/app/api/dashboard/overview/route');
    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch dashboard stats' });
  });
});
