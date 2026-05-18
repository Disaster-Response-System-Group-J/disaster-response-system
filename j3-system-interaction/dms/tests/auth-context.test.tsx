import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';

function AuthProbe() {
  const { user, isAuthenticated, isLoading, login, logout, hasPermission, hasRole } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="name">{user?.name ?? 'none'}</span>
      <span data-testid="can-dashboard">{String(hasPermission('view:dashboard'))}</span>
      <span data-testid="is-admin">{String(hasRole(UserRole.SYSTEM_ADMIN))}</span>
      <button onClick={() => login('admin@example.com', 'secret')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  it('restores a saved user from localStorage', async () => {
    localStorage.setItem('dms_user', JSON.stringify({
      id: 'u-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: UserRole.SYSTEM_ADMIN,
    }));

    render(<AuthProvider><AuthProbe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('name')).toHaveTextContent('Admin User');
    expect(screen.getByTestId('can-dashboard')).toHaveTextContent('true');
    expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
  });

  it('logs in through the API and persists the returned user', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        success: true,
        user: {
          id: 'u-2',
          email: 'ops@example.com',
          name: 'Ops User',
          role: UserRole.OPERATIONS_OFFICER_ZONAL,
        },
      }),
    }));

    render(<AuthProvider><AuthProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await userEvent.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Ops User'));
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'admin@example.com', passkey: 'secret' }),
    }));
    expect(JSON.parse(localStorage.getItem('dms_user') || '{}')).toMatchObject({ name: 'Ops User' });
  });

  it('clears auth state on logout', async () => {
    localStorage.setItem('dms_user', JSON.stringify({
      id: 'u-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: UserRole.SYSTEM_ADMIN,
    }));

    render(<AuthProvider><AuthProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('true'));

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'logout' }));
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('name')).toHaveTextContent('none');
    expect(localStorage.getItem('dms_user')).toBeNull();
  });
});
