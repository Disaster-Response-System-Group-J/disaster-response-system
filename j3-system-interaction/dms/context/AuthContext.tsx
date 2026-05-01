'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, UserRole, ROLE_PERMISSIONS } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dms_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        setUser(parsed);
        setIsAuthenticated(true);
      }
    } catch {
      localStorage.removeItem('dms_user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Persist user
  useEffect(() => {
    if (user) {
      localStorage.setItem('dms_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('dms_user');
    }
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, passkey: password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Invalid credentials');
    }
    setUser(data.user);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false;
      return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
    },
    [user],
  );

  const hasRole = useCallback(
    (role: UserRole) => {
      if (!user) return false;
      if (user.role === UserRole.ADMIN) return true; // Admin has all roles
      return user.role === role;
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout, hasPermission, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
