'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle, ChevronDown, TrendingUp, Users, Activity, Truck, Home,
  CloudRain, MapPin, Clock, ExternalLink, FileText,
} from 'lucide-react';
import Map, { Marker, ViewStateChangeEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import Link from 'next/link';
import { VerificationStatus, IncidentSeverity, UserRole } from '@/types';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';
import { normalizeRiskAlert } from '@/lib/risk-alert';

// Color mapping for the map pins
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444', // red-500
  HIGH: '#f97316',     // orange-500
  MEDIUM: '#eab308',   // yellow-500
  LOW: '#3b82f6',      // blue-500
  PENDING: '#a855f7',  // purple-500 for unverified incoming reports
};

export default function DashboardPage() {
  const socket = useSocket();
  const { user } = useAuth();
  const isNationalLevel = !user || user.role === UserRole.SYSTEM_ADMIN || user.role.includes('NATIONAL') || user.role === UserRole.INCIDENT_COMMANDER_NATIONAL;
  const scopedDistrict = isNationalLevel ? null : (user as any)?.assignedDistrict || null;
  const [isLoading, setIsLoading] = useState(true);

  // Aggregated live data state
  const [data, setData] = useState({
    activeIncidents: 0,
    activeIncidentsChange: 2, // Simulated 24h trend
    criticalAlerts: 0,
    peopleAffected: 0,
    inShelters: 0,
    incidents: { floods: 0, landslides: 0, droughts: 0, other: 0 },
    resources: {
      availableTeams: { current: 0, total: 0 },
      activeShelters: { current: 0, total: 0 },
      heavyMachinery: { current: 0, total: 0 }
    }
  });

  const [pendingCount, setPendingCount] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [mapPins, setMapPins] = useState<any[]>([]);

  // Map viewport state
  const [viewState, setViewState] = useState({ longitude: 80.7718, latitude: 7.8731, zoom: 6.5, pitch: 0, bearing: 0 });

  // Fetch all initial data from APIs
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [incidentsRes, reportsRes, resourcesRes, sheltersRes, alertsRes] = await Promise.all([
          fetch('/api/incidents').then(res => res.ok ? res.json() : []),
          fetch('/api/reports').then(res => res.ok ? res.json() : []),
          fetch('/api/resources/list').then(res => res.ok ? res.json() : []),
          fetch('/api/relief/shelter').then(res => res.ok ? res.json() : []),
          fetch('/api/alerts').then(res => res.ok ? res.json() : [])
        ]);

        // Process Incidents
        const activeIncidents = incidentsRes.filter((i: any) => i.status === 'ACTIVE');
        const floods = activeIncidents.filter((i: any) => i.title?.toUpperCase().includes('FLOOD')).length;
        const landslides = activeIncidents.filter((i: any) => i.title?.toUpperCase().includes('LANDSLIDE')).length;
        const droughts = activeIncidents.filter((i: any) => i.title?.toUpperCase().includes('DROUGHT')).length;
        const other = activeIncidents.length - (floods + landslides + droughts);
        const peopleAffected = activeIncidents.reduce((sum: number, i: any) => sum + (i.affected_population || 0), 0);

        // Process Shelters
        const inShelters = sheltersRes.reduce((sum: number, s: any) => sum + (s.current_occupancy || 0), 0);
        const activeSheltersCount = sheltersRes.filter((s: any) => s.status !== 'CLOSED').length;

        // Process Resources
        const resourcesArray = resourcesRes.resources || [];

        // 2. Process Resources using the extracted array[cite: 5]
        const teams = resourcesArray.filter((r: any) =>
          r.type?.toUpperCase() === 'TEAM' ||
          r.type?.toUpperCase() === 'PERSONNEL' ||
          r.type?.toUpperCase() === 'RESCUE_TEAM'
        );

        const availableTeams = teams.filter((r: any) => r.status === 'AVAILABLE').length;

        const machinery = resourcesArray.filter((r: any) =>
          r.type?.toUpperCase() === 'MACHINERY' ||
          r.type?.toUpperCase() === 'VEHICLE' ||
          r.type?.toUpperCase() === 'BOAT'
        );

        const availableMachinery = machinery.filter((r: any) => r.status === 'AVAILABLE').length;
        // Process Alerts & Reports
        const pendingReports = reportsRes.filter((r: any) => r.status === 'PENDING_REVIEW').length;
        const criticalAlertsCount = Array.isArray(alertsRes) ? alertsRes.filter((a: any) => a.severity === 'CRITICAL').length : 0;

        setData({
          activeIncidents: activeIncidents.length,
          activeIncidentsChange: 2,
          criticalAlerts: criticalAlertsCount,
          peopleAffected,
          inShelters,
          incidents: { floods, landslides, droughts, other },
          resources: {
            availableTeams: { current: availableTeams, total: teams.length || 1 },
            activeShelters: { current: activeSheltersCount, total: sheltersRes.length || 1 },
            heavyMachinery: { current: availableMachinery, total: machinery.length || 1 }
          }
        });

        setPendingCount(pendingReports);

        // Map pins processing
        setMapPins(activeIncidents.map((inc: any) => ({
          incidentId: inc.incident_id.toString(),
          severity: inc.severity || 'LOW',
          status: inc.status,
          latitude: Number(inc.latitude) || 0,
          longitude: Number(inc.longitude) || 0,
        })));

        // Alerts processing
        if (Array.isArray(alertsRes)) {
          setRecentAlerts(alertsRes.map((a: any) => normalizeRiskAlert(a)));
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const criticalAlerts = recentAlerts.filter(a => a.severity === 'CRITICAL' || a.severity === IncidentSeverity.CRITICAL);

  // Listen for real-time events from Socket
  useEffect(() => {
    if (!socket) return;

    const handleNewReport = (report: any) => {
      setPendingCount(prev => prev + 1);
      if (report.latitude && report.longitude) {
        setMapPins(prev => [...prev, {
          incidentId: report.reportId || `new-${Date.now()}`,
          severity: 'PENDING',
          status: 'UNVERIFIED',
          latitude: report.latitude,
          longitude: report.longitude,
        }]);
      }
    };

    const handleNewAlert = (incoming: any) => {
      const alert = normalizeRiskAlert(incoming);
      setRecentAlerts(prev => [alert, ...prev].slice(0, 5));
      if (alert.severity === IncidentSeverity.CRITICAL || alert.severity === 'CRITICAL') {
        setData(prev => ({ ...prev, criticalAlerts: prev.criticalAlerts + 1 }));
      }
    };

    socket.on('dashboard:new-report', handleNewReport);
    socket.on('dashboard:risk-alert', handleNewAlert);

    return () => {
      socket.off('dashboard:new-report', handleNewReport);
      socket.off('dashboard:risk-alert', handleNewAlert);
    };
  }, [socket]);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full bg-[#0a0f16] text-white items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-[#0a0f16] text-white overflow-hidden">
      {/* Alert Banner */}
      {criticalAlerts[0] && (
        <div className="bg-[#451414] border-b border-red-900/50 px-6 py-3 flex items-center gap-3 shrink-0">
          <AlertTriangle size={16} className="text-red-400" />
          <p className="text-xs font-semibold text-slate-200 flex-1 tracking-wide">
            {criticalAlerts[0].title.toUpperCase()}
          </p>
          <Link href="/dashboard/alerts" className="text-xs text-red-300 hover:text-red-200 font-semibold whitespace-nowrap transition-colors">
            View Details
          </Link>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">Operational Overview</p>
              <h1 className="text-4xl font-extrabold tracking-tight">{isNationalLevel ? 'National Status' : `${scopedDistrict || 'District'} Overview`}</h1>
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-300">{user.name}</p>
                  <p className="text-[10px] text-slate-500 font-semibold tracking-wider">{user.role.replace(/_/g, ' ')}</p>
                </div>
              )}
              {!isNationalLevel && scopedDistrict && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs font-bold text-blue-400">
                  <MapPin size={12} /> {scopedDistrict} Zone
                </span>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Top Row */}
            <div className="grid grid-cols-4 gap-6">
              {/* Active Incidents */}
              <div className="col-span-1 bg-[#131924] border border-slate-800/80 rounded-xl p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">ACTIVE INCIDENTS</span>
                  <Activity className="text-red-400 w-4 h-4" />
                </div>
                <div className="flex items-baseline gap-3 my-4">
                  <span className="text-5xl font-bold tracking-tight">{data.activeIncidents}</span>
                  <span className="text-xs font-bold text-red-400 flex items-center bg-red-400/10 px-2 py-1 rounded">
                    <TrendingUp className="w-3 h-3 mr-1" /> +{data.activeIncidentsChange} in 24h
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3 pt-4 border-t border-slate-800/50">
                  <Stat label="FLOODS" value={data.incidents.floods} />
                  <Stat label="LANDSLIDES" value={data.incidents.landslides} />
                  <Stat label="DROUGHTS" value={data.incidents.droughts} />
                  <Stat label="OTHER" value={data.incidents.other} />
                </div>
              </div>

              {/* Pending Reports */}
              <div className="col-span-1 bg-[#131924] border border-orange-500/20 rounded-xl p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-6 right-6 w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.8)] animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">PENDING REPORTS</span>
                <span className="text-5xl font-bold text-orange-400 tracking-tight my-4">
                  {String(pendingCount).padStart(2, '0')}
                </span>
                <Link href="/dashboard/incoming-reports"
                  className="w-full py-2.5 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg text-xs font-semibold text-orange-300 transition-colors text-center flex items-center justify-center gap-2">
                  <FileText size={14} /> Review Reports
                </Link>
              </div>

              {/* Critical Alerts */}
              <div className="col-span-1 bg-[#131924] border border-slate-800/80 rounded-xl p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-6 right-6 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
                <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">CRITICAL ALERTS</span>
                <span className="text-5xl font-bold text-red-400 tracking-tight my-4">
                  {String(data.criticalAlerts).padStart(2, '0')}
                </span>
                <Link href="/dashboard/alerts"
                  className="w-full py-2.5 bg-slate-800/50 hover:bg-slate-700/80 border border-slate-700/50 rounded-lg text-xs font-semibold text-slate-200 transition-colors text-center">
                  Review Alerts
                </Link>
              </div>

              {/* People Affected */}
              <div className="col-span-1 bg-[#131924] border border-slate-800/80 rounded-xl p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase leading-relaxed">PEOPLE AFFECTED<br />(EST)</span>
                  <Users className="text-slate-500 w-4 h-4" />
                </div>
                <span className="text-4xl font-bold tracking-tight my-4">
                  {data.peopleAffected > 1000 ? `${(data.peopleAffected / 1000).toFixed(1)}K` : data.peopleAffected}
                </span>
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-400 mb-2">
                    <span>In Shelters</span>
                    <span className="text-white">{data.inShelters.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${Math.min(100, (data.inShelters / (data.peopleAffected || 1)) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Row */}
            <div className="grid grid-cols-3 gap-6">
              {/* Resource Readiness */}
              <div className="col-span-1 bg-[#131924] border border-slate-800/80 rounded-xl p-6 flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-6 block">RESOURCE READINESS</span>
                <div className="space-y-6 flex-1">
                  <ResBar title="Available Teams" current={data.resources.availableTeams.current} total={data.resources.availableTeams.total} icon={<Users size={12} />} color="bg-blue-400" />
                  <ResBar title="Active Shelters" current={data.resources.activeShelters.current} total={data.resources.activeShelters.total} icon={<Home size={12} />} color="bg-teal-400" />
                  <ResBar title="Heavy Machinery" current={data.resources.heavyMachinery.current} total={data.resources.heavyMachinery.total} icon={<Truck size={12} />} color="bg-slate-400" />
                </div>
                <Link href="/dashboard/resources"
                  className="w-full mt-8 py-2.5 bg-slate-800/50 hover:bg-slate-700/80 border border-slate-700/50 rounded-lg text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-2">
                  <Truck size={14} className="text-slate-400" /> Resource Tracking
                </Link>
              </div>

              {/* Live Map */}
              <div className="col-span-2 bg-[#131924] border border-slate-800/80 rounded-xl overflow-hidden relative min-h-[320px]">
                <Map {...viewState} onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
                  mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json">

                  {/* DYNAMIC MARKERS */}
                  {mapPins.map(inc => (
                    <Marker
                      key={inc.incidentId}
                      longitude={inc.longitude}
                      latitude={inc.latitude}
                      anchor="center"
                      style={{ background: 'transparent', border: 'none', padding: 0 }}
                    >
                      <div className="relative">
                        <div
                          className="w-3 h-3 rounded-full border-2 border-white shadow-lg z-10 relative"
                          style={{ backgroundColor: SEVERITY_COLORS[inc.severity] || SEVERITY_COLORS['PENDING'] }}
                        />
                        {(inc.severity === 'CRITICAL' || inc.severity === 'PENDING') && (
                          <div
                            className="absolute inset-0 rounded-full animate-ping opacity-75"
                            style={{ backgroundColor: SEVERITY_COLORS[inc.severity] || SEVERITY_COLORS['PENDING'] }}
                          />
                        )}
                      </div>
                    </Marker>
                  ))}

                </Map>
                <div className="absolute top-6 right-6 w-52 bg-[#181f2c]/95 backdrop-blur-md border border-slate-700/60 rounded-xl p-5 shadow-2xl">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest block mb-4 uppercase">MAP LAYERS</span>
                  <Link href="/dashboard/incident-map"
                    className="w-full py-2 bg-slate-800/60 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-colors flex justify-center items-center gap-2">
                    Full Map <ExternalLink size={12} className="text-slate-400" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Bottom Row — Weather + Recent Alerts */}
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-1 bg-[#131924] border border-slate-800/80 rounded-xl p-6">
                <span className="text-[10px] font-bold text-slate-400 tracking-widest block mb-5 uppercase">MONSOON PATTERN (SW)</span>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                    <CloudRain className="text-blue-400" size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Heavy Rainfall</h3>
                    <p className="text-xs text-slate-400">150mm expected next 24h</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 tracking-widest block mb-3 uppercase">HIGH RISK ZONES</span>
                <div className="flex gap-2 flex-wrap">
                  {['Ratnapura', 'Kalutara', 'Colombo', 'Kegalle'].map((z) => (
                    <span key={z} className="px-3 py-1.5 text-xs font-semibold rounded-md border bg-red-900/40 text-red-300 border-red-800/50">{z}</span>
                  ))}
                </div>
              </div>

              <div className="col-span-2 bg-[#131924] border border-slate-800/80 rounded-xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">RECENT ALERTS</span>
                  <Link href="/dashboard/alerts" className="text-xs text-slate-400 hover:text-white font-semibold transition-colors">View All</Link>
                </div>
                <div className="space-y-2">
                  {recentAlerts.length === 0 ? (
                    <div className="text-slate-500 text-sm py-4">No active alerts at this time.</div>
                  ) : recentAlerts.slice(0, 4).map((alert) => (
                    <div key={alert.alertId} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/30 transition-colors border border-transparent hover:border-slate-800/50">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${alert.severity === 'CRITICAL' ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                          <AlertTriangle size={16} className={alert.severity === 'CRITICAL' ? 'text-red-400' : 'text-blue-400'} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-200 mb-1">{alert.title}</h4>
                          <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500">
                            <span className="flex items-center gap-1"><MapPin size={10} /> {alert.district}</span>
                            <span className="flex items-center gap-1"><Clock size={10} /> {new Date(alert.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {(alert.predictionCategory || alert.considerationScore !== undefined) && (
                            <div className="mt-1 text-[10px] text-slate-400 flex flex-wrap gap-x-2 gap-y-1">
                              {alert.predictionCategory && <span>Category: {alert.predictionCategory}</span>}
                              {alert.predictionProbability !== undefined && <span>Prob: {alert.predictionProbability.toFixed(3)}</span>}
                              {alert.considerationScore !== undefined && <span>Score: {alert.considerationScore.toFixed(3)}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border ${alert.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>{alert.severity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function FilterBtn({ label }: { label: string }) {
  return (
    <button className="flex items-center gap-2 px-4 py-2.5 bg-[#131924] border border-slate-800/80 hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-300 transition-colors">
      {label} <ChevronDown size={14} className="text-slate-500" />
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-500 tracking-widest mb-1 uppercase">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function ResBar({ title, current, total, icon, color }: { title: string; current: number; total: number; icon: React.ReactNode; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="text-slate-400">{icon}</div>
          <span className="text-xs font-semibold text-slate-300">{title}</span>
        </div>
        <div className="text-xs font-bold text-white">{current} <span className="text-slate-500 font-medium">/ {total}</span></div>
      </div>
      <div className="w-full bg-slate-800/80 h-[4px] rounded-full overflow-hidden">
        <div className={`${color} h-full rounded-full`} style={{ width: `${(current / Math.max(total, 1)) * 100}%` }} />
      </div>
    </div>
  );
}