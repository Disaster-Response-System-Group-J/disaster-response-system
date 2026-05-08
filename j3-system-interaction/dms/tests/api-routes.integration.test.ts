import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  pool: {
    query: queryMock,
  },
}));

import { GET as getIncidents } from '@/app/api/incidents/route';
import { GET as getActivity } from '@/app/api/activity/route';

describe('API integration testing - Next.js route handlers', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('incidents route returns database rows on success', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ incident_id: 'INC-1', status: 'ACTIVE' }],
    });

    const response = await getIncidents();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([{ incident_id: 'INC-1', status: 'ACTIVE' }]);
    expect(queryMock).toHaveBeenCalledWith(
      'SELECT * FROM public."ActiveIncident" ORDER BY created_at DESC',
    );
  });

  it('activity route returns both recent dispatches and reports', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ dispatch_id: 'DSP-1' }] })
      .mockResolvedValueOnce({ rows: [{ report_id: 'REP-1' }] });

    const response = await getActivity();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      recentDispatches: [{ dispatch_id: 'DSP-1' }],
      recentReports: [{ report_id: 'REP-1' }],
    });
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('activity route returns 500 payload when database fails', async () => {
    queryMock.mockRejectedValueOnce(new Error('db offline'));

    const response = await getActivity();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to fetch activity' });
  });
});
