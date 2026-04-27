"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authAPI, dashboardAPI } from "@/lib/api-client";
import { useCallback } from "react";

interface User {
  email: string;
  role: string;
  name: string;
  id: string;
}

interface DashboardData {
  activeIncidents: number;
  activeIncidentsChange: number;
  criticalAlerts: number;
  peopleAffected: number;
  peopleAffectedChange: number;
  inShelters: number;
  incidents: {
    floods: number;
    landslides: number;
    other: number;
  };
  resources: {
    availableTeams: { current: number; total: number };
    activeShelters: { current: number; total: number };
    heavyMachinery: { current: number; total: number };
  };
  alerts: Array<{
    id: number;
    severity: string;
    title: string;
    location: string;
    time: string;
  }>;
}

interface AppContextType {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, passkey: string) => Promise<void>;
  logout: () => void;

  // Dashboard data
  dashboardData: DashboardData | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
  refreshDashboard: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Dashboard state
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Login handler
  const login = async (email: string, passkey: string) => {
    try {
      const response = await authAPI.login(email, passkey);
      if (response.success) {
        setUser(response.user);
        setIsAuthenticated(true);
        // Fetch dashboard data after login
        await refreshDashboard();
      } else {
        throw new Error(response.message || "Login failed");
      }
    } catch (error) {
      throw error;
    }
  };

  // Logout handler
  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setDashboardData(null);
  };

  // Fetch dashboard data
const refreshDashboard = useCallback(async () => {
  try {
    setDashboardLoading(true);
    setDashboardError(null);
    const data = await dashboardAPI.getOverview();
    setDashboardData(data);
  } catch (error) {
    setDashboardError(error instanceof Error ? error.message : "Failed to fetch data");
  } finally {
    setDashboardLoading(false);
  }
}, []);

  // Restore auth from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem("user");
      }
    }
  }, []);

  // Save user to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  const value: AppContextType = {
    user,
    isAuthenticated,
    login,
    logout,
    dashboardData,
    dashboardLoading,
    dashboardError,
    refreshDashboard,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
