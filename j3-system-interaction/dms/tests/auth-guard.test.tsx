import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AuthGuard from '@/components/auth/AuthGuard';
import { UserRole } from '@/types';

const replaceMock = vi.fn();
let authState = {
  isAuthenticated: true,
  isLoading: false,
  hasPermission: vi.fn((permission: string) => permission === 'view:dashboard'),
  hasRole: vi.fn((role: UserRole) => role === UserRole.SYSTEM_ADMIN),
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}));

describe('AuthGuard', () => {
  it('shows the loading state while authentication is pending', () => {
    authState = { ...authState, isLoading: true, isAuthenticated: false };

    render(<AuthGuard><div>Secret dashboard</div></AuthGuard>);

    expect(screen.getByText('AUTHENTICATING...')).toBeInTheDocument();
    expect(screen.queryByText('Secret dashboard')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to the fallback URL', async () => {
    authState = { ...authState, isLoading: false, isAuthenticated: false };

    render(<AuthGuard fallbackUrl="/login"><div>Secret dashboard</div></AuthGuard>);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('Secret dashboard')).not.toBeInTheDocument();
  });

  it('redirects authenticated users without required permissions', async () => {
    authState = {
      ...authState,
      isLoading: false,
      isAuthenticated: true,
      hasPermission: vi.fn(() => false),
    };

    render(<AuthGuard requiredPermissions={['manage:users']}><div>Admin dashboard</div></AuthGuard>);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/dashboard'));
  });

  it('renders children when the user is authenticated and authorized', () => {
    authState = {
      ...authState,
      isLoading: false,
      isAuthenticated: true,
      hasPermission: vi.fn(() => true),
      hasRole: vi.fn(() => true),
    };

    render(
      <AuthGuard requiredRoles={[UserRole.SYSTEM_ADMIN]} requiredPermissions={['view:dashboard']}>
        <div>Secret dashboard</div>
      </AuthGuard>,
    );

    expect(screen.getByText('Secret dashboard')).toBeInTheDocument();
  });
});
