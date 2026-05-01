'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { UserRole } from '@/types';

interface AuthGuardProps {
  children: ReactNode;
  requiredPermissions?: string[];
  requiredRoles?: UserRole[];
  fallbackUrl?: string;
}

export default function AuthGuard({
  children,
  requiredPermissions = [],
  requiredRoles = [],
  fallbackUrl = '/login',
}: AuthGuardProps) {
  const { isAuthenticated, isLoading, hasPermission, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace(fallbackUrl);
      return;
    }

    // Check permissions
    if (requiredPermissions.length > 0) {
      const hasAll = requiredPermissions.every((p) => hasPermission(p));
      if (!hasAll) {
        router.replace('/dashboard');
        return;
      }
    }

    // Check roles
    if (requiredRoles.length > 0) {
      const hasAny = requiredRoles.some((r) => hasRole(r));
      if (!hasAny) {
        router.replace('/dashboard');
        return;
      }
    }
  }, [isAuthenticated, isLoading, hasPermission, hasRole, requiredPermissions, requiredRoles, router, fallbackUrl]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0f16]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs font-bold text-slate-500 tracking-widest">AUTHENTICATING...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
