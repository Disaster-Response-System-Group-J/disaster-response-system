'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Shield, LayoutGrid, Map as MapIcon, FileText, Truck, AlertTriangle,
  BarChart2, Settings, Bell, UserCircle, LogOut, Users, RadioTower, BrainCircuit, Database, Menu, X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AuthGuard from '@/components/auth/AuthGuard';
import { MOCK_ALERTS } from '@/data/mock-data';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'COMMAND CENTER', icon: LayoutGrid, permission: 'view:dashboard' },
  { href: '/dashboard/incoming-reports', label: 'INCOMING REPORTS', icon: FileText, permission: 'view:incoming-reports' },
  { href: '/dashboard/incident-map', label: 'INCIDENT MAP', icon: MapIcon, permission: 'view:incident-map' },
  { href: '/dashboard/resources', label: 'RESOURCE TRACKING', icon: Truck, permission: 'view:resources' },
  { href: '/dashboard/alerts', label: 'ALERTS', icon: AlertTriangle, permission: 'view:alerts' },
  { href: '/dashboard/analytics', label: 'ANALYTICS', icon: BarChart2, permission: 'view:analytics' },
  { href: '/dashboard/sensors', label: 'SENSORS', icon: RadioTower, permission: 'view:sensors' },
  { href: '/dashboard/predictions', label: 'PREDICTIONS', icon: BrainCircuit, permission: 'view:predictions' },
  { href: '/dashboard/audit', label: 'AUDIT DASHBOARD', icon: Database, permission: 'view:blockchain-audit' },
  { href: '/dashboard/admin', label: 'ADMIN PANEL', icon: Users, permission: 'manage:users' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard requiredPermissions={['view:dashboard']}>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}

function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, hasPermission } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<'notifications' | 'settings' | 'profile' | null>(null);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };
  const navigateFromMenu = (href: string) => {
    setActiveDropdown(null);
    router.push(href);
  };

  const visibleNav = NAV_ITEMS.filter((item) => hasPermission(item.permission));
  const username = user?.email?.split('@')[0] || user?.name?.toLowerCase().replace(/\s+/g, '.') || 'user';
  const recentNotifications = [...MOCK_ALERTS]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!dropdownContainerRef.current?.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="flex h-screen bg-[#0a0f16] text-white font-sans overflow-hidden">

      {/* ─── Mobile/Tablet Sidebar Overlay Backdrop ─── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Sidebar ─── */}
      {/* On lg+ it's a permanent 280px column. On smaller screens it slides in as a z-40 overlay. */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-[280px] bg-[#0a0f16] border-r border-slate-800/50 flex flex-col shrink-0
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:z-20
        `}
      >
        {/* Sidebar Header */}
        <div className="p-6 flex items-start justify-between">
          <div>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 mb-1"
              onClick={() => setSidebarOpen(false)}
            >
              <Shield size={24} className="text-blue-400 fill-blue-400" />
              <h1 className="text-sm font-bold tracking-wide text-slate-100">DMC SRI LANKA</h1>
            </Link>
            <p className="text-[9px] font-bold text-slate-500 tracking-widest uppercase ml-9">
              OPERATIONAL COMMAND
            </p>
          </div>
          {/* Close button — only on mobile/tablet */}
          <button
            className="lg:hidden text-slate-500 hover:text-white transition-colors mt-1 shrink-0"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 scrollbar-none">
          <div className="space-y-1">
            {visibleNav.map((item) => {
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                >
                  <div
                    className={`w-full flex items-center gap-4 px-8 py-3.5 transition-all relative group ${
                      isActive
                        ? 'text-slate-200 bg-slate-800/30'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/10'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                    )}
                    <div className={isActive ? 'text-blue-400' : 'group-hover:text-slate-400 transition-colors'}>
                      <item.icon size={18} />
                    </div>
                    <span className="text-[10px] font-bold tracking-widest uppercase mt-0.5">
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="mt-auto py-4 space-y-1 border-t border-slate-800/50">
          <div className="px-6 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold shrink-0">
              {user?.name?.charAt(0) ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
              <p className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">{user?.role?.replace('_', ' ')}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 transition-colors" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0a0f16]">

        {/* Top Header */}
        <header className="h-16 bg-[#0a0f16] border-b border-slate-800/50 flex items-center justify-between px-4 sm:px-8 shrink-0 z-10">
          <div className="flex items-center gap-3">
            {/* Hamburger — only visible on mobile/tablet */}
            <button
              className="lg:hidden text-slate-400 hover:text-white transition-colors p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
              <span className="hidden sm:inline text-[10px] font-bold text-slate-500 tracking-widest uppercase">SYSTEM ONLINE</span>
            </div>
          </div>

          <div className="flex items-center gap-5 text-[11px] font-bold text-slate-400 tracking-wider relative" ref={dropdownContainerRef}>

            {/* Notifications */}
            <div className="relative">
              <button
                className="relative hover:text-white transition-colors"
                aria-label="Open notifications"
                title="Notifications"
                onClick={() => setActiveDropdown((prev) => (prev === 'notifications' ? null : 'notifications'))}
              >
                <Bell size={16} />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[#0a0f16]" />
              </button>
              {activeDropdown === 'notifications' && (
                <div className="absolute top-8 right-0 w-72 bg-[#131924] border border-slate-800/80 rounded-xl shadow-xl p-3 z-40">
                  <p className="text-[10px] font-bold tracking-widest text-slate-500 mb-2">NOTIFICATIONS</p>
                  <div className="space-y-2 text-xs font-medium text-slate-300">
                    {recentNotifications.map((alert) => (
                      <button
                        key={alert.alertId}
                        onClick={() => navigateFromMenu(`/dashboard/alerts?alertId=${encodeURIComponent(alert.alertId)}`)}
                        className="w-full text-left p-2 rounded-lg bg-slate-800/50 border border-slate-700/60 hover:bg-slate-800 transition-colors"
                      >
                        <p className="text-slate-200 font-semibold truncate">{alert.title}</p>
                        <p className="text-slate-400 text-[10px] mt-0.5 truncate">{alert.district} | {alert.severity}</p>
                      </button>
                    ))}
                    {recentNotifications.length === 0 && (
                      <p className="text-slate-500 text-[11px] p-2">No notifications available.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="relative">
              <button
                className="hover:text-white transition-colors"
                aria-label="Open settings"
                title="Settings"
                onClick={() => setActiveDropdown((prev) => (prev === 'settings' ? null : 'settings'))}
              >
                <Settings size={16} />
              </button>
              {activeDropdown === 'settings' && (
                <div className="absolute top-8 right-0 w-56 bg-[#131924] border border-slate-800/80 rounded-xl shadow-xl p-3 z-40">
                  <p className="text-[10px] font-bold tracking-widest text-slate-500 mb-2">SETTINGS</p>
                  <div className="space-y-2 text-xs font-semibold text-slate-300">
                    <button onClick={() => navigateFromMenu('/dashboard/admin')} className="w-full text-left p-2 rounded-lg hover:bg-slate-800/70 transition-colors">Admin Dashboard</button>
                    <button onClick={() => navigateFromMenu('/dashboard/alerts')} className="w-full text-left p-2 rounded-lg hover:bg-slate-800/70 transition-colors">Alert Preferences</button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                className="hover:text-white transition-colors"
                aria-label="Open profile"
                title="Profile"
                onClick={() => setActiveDropdown((prev) => (prev === 'profile' ? null : 'profile'))}
              >
                <UserCircle size={18} />
              </button>
              {activeDropdown === 'profile' && (
                <div className="absolute top-8 right-0 w-64 bg-[#131924] border border-slate-800/80 rounded-xl shadow-xl p-3 z-40">
                  <p className="text-[10px] font-bold tracking-widest text-slate-500 mb-3">PROFILE</p>
                  <div className="space-y-2 text-xs">
                    <div>
                      <p className="text-slate-500">Name</p>
                      <p className="text-slate-200 font-semibold">{user?.name || 'Unknown User'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Username</p>
                      <p className="text-slate-200 font-semibold">@{username}</p>
                    </div>
                    <div className="pt-2 mt-2 border-t border-slate-800/70 space-y-1">
                      <button onClick={() => navigateFromMenu('/dashboard/admin?editSelf=1')} className="w-full text-left p-2 rounded-lg text-slate-300 font-semibold hover:bg-slate-800/70 transition-colors">Edit Profile</button>
                      <button onClick={() => { setActiveDropdown(null); handleLogout(); }} className="w-full text-left p-2 rounded-lg text-red-400 font-semibold hover:bg-red-500/10 transition-colors">Logout</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
