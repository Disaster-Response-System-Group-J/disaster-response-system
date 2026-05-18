import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const compareMock = vi.fn();

vi.mock('@/lib/db', () => ({
  pool: { query: queryMock },
}));

vi.mock('bcryptjs', () => ({
  default: { compare: compareMock },
  compare: compareMock,
}));

function requestWithBody(body: unknown) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as any;
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    queryMock.mockReset();
    compareMock.mockReset();
  });

  it('normalizes the email, validates the password, and returns a safe user', async () => {
    queryMock.mockResolvedValue({
      rows: [{
        id: 'u-1',
        email: 'Admin@Example.com',
        name: 'Admin User',
        role: 'SYSTEM_ADMIN',
        password_hash: 'hashed-password',
      }],
    });
    compareMock.mockResolvedValue(true);

    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(requestWithBody({ email: ' Admin@Example.com ', passkey: 'secret' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('lower(email)'), ['admin@example.com']);
    expect(compareMock).toHaveBeenCalledWith('secret', 'hashed-password');
    expect(body.success).toBe(true);
    expect(body.user).toMatchObject({ id: 'u-1', name: 'Admin User' });
    expect(body.user.password_hash).toBeUndefined();
    expect(body.token).toMatch(/^demo-token-/);
  });

  it('rejects unknown users', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(requestWithBody({ email: 'missing@example.com', passkey: 'secret' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Invalid credentials',
    });
  });

  it('rejects invalid passwords', async () => {
    queryMock.mockResolvedValue({
      rows: [{ id: 'u-1', email: 'admin@example.com', password_hash: 'hashed-password' }],
    });
    compareMock.mockResolvedValue(false);

    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(requestWithBody({ email: 'admin@example.com', passkey: 'wrong' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Invalid credentials',
    });
  });
});
