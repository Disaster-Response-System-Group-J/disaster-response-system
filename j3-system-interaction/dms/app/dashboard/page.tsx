'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle, ChevronDown, TrendingUp, Users, Activity, Truck, Home,
  CloudRain, MapPin, Clock, ExternalLink, FileText,
} from 'lucide-react';
import Map, { Marker, ViewStateChangeEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import Link from 'next/link';
import { MOCK_DASHBOARD_SUMMARY, MOCK_ALERTS, MOCK_INCOMING_REPORTS, MOCK_CONFIRMED_INCIDENTS } from '@/data/mock-data';
import { VerificationStatus, IncidentSeverity } from '@/types';
import { useSocket } from '@/context/SocketContext';

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

  const [data, setData] = useState(MOCK_DASHBOARD_SUMMARY);
  const [pendingCount, setPendingCount] = useState(
    MOCK_INCOMING_REPORTS.filter(r => r.verificationStatus === VerificationStatus.PENDING_REVIEW).length
  );
  const [recentAlerts, setRecentAlerts] = useState(
    MOCK_ALERTS.filter(a => a.isActive)
  );
  
  // State for map pins, initialized with confirmed incidents
  const [mapPins, setMapPins] = useState<any[]>(MOCK_CONFIRMED_INCIDENTS);
  
  // Map viewport state
  const [viewState, setViewState] = useState({ longitude: 80.7718, latitude: 7.8731, zoom: 6.5, pitch: 0, bearing: 0 });

  const criticalAlerts = recentAlerts.filter(a => a.severity === IncidentSeverity.CRITICAL);

  // Listen for real-time events from the Event Bridge / Kafka
  useEffect(() => {
    if (!socket) return;

    // Handle new incoming SOS reports
    const handleNewReport = (report: any) => {
      setPendingCount(prev => prev + 1);
      
      // If the report has coordinates, drop a pending pin on the map
      if (report.latitude && report.longitude) {
        const newPin = {
          incidentId: report.reportId || `new-${Date.now()}`,
          severity: 'PENDING',
          status: 'UNVERIFIED',
          latitude: report.latitude,
          longitude: report.longitude,
        };
        setMapPins(prev => [...prev, newPin]);
      }
    };

    // Handle new alerts from the J2 Risk Engine
    const handleNewAlert = (alert: any) => {
      setRecentAlerts(prev => [alert, ...prev].slice(0, 5)); // Keep only top 5 recent
      if (alert.severity === IncidentSeverity.CRITICAL) {
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
              <h1 className="text-4xl font-extrabold tracking-tight">National Status</h1>
            </div>
            <div className="flex items-center gap-3">
              <FilterBtn label="District: All" />
              <FilterBtn label="Disaster Type" />
              <FilterBtn label="Severity" />
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
                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800/50">
                  <Stat label="FLOODS" value={data.incidents.floods} />
                  <Stat label="LANDSLIDES" value={data.incidents.landslides} />
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
                  {(data.peopleAffected / 1000).toFixed(1)}K
                </span>
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-400 mb-2">
                    <span>In Shelters</span>
                    <span className="text-white">{data.inShelters.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${(data.inShelters / data.peopleAffected) * 100}%` }} />
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
                    >
                      <div className="relative">
                        <div
                          className="w-3 h-3 rounded-full border-2 border-white shadow-lg z-10 relative"
                          style={{ backgroundColor: SEVERITY_COLORS[inc.severity] || SEVERITY_COLORS['PENDING'] }}
                        />
                        {/* Add pulse effect for Critical or Pending pins */}
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
                  {recentAlerts.slice(0, 4).map((alert) => (
                    <div key={alert.alertId} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/30 transition-colors border border-transparent hover:border-slate-800/50">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${alert.severity === IncidentSeverity.CRITICAL ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                          <AlertTriangle size={16} className={alert.severity === IncidentSeverity.CRITICAL ? 'text-red-400' : 'text-blue-400'} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-200 mb-1">{alert.title}</h4>
                          <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500">
                            <span className="flex items-center gap-1"><MapPin size={10} /> {alert.district}</span>
                            <span className="flex items-center gap-1"><Clock size={10} /> {new Date(alert.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border ${
                        alert.severity === IncidentSeverity.CRITICAL ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-slate-800 text-slate-300 border-slate-700'
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
  return (<div><p className="text-[10px] font-bold text-slate-500 tracking-widest mb-1 uppercase">{label}</p><p className="text-xl font-bold">{value}</p></div>);
}
function ResBar({ title, current, total, icon, color }: { title: string; current: number; total: number; icon: React.ReactNode; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2"><div className="text-slate-400">{icon}</div><span className="text-xs font-semibold text-slate-300">{title}</span></div>
        <div className="text-xs font-bold text-white">{current} <span className="text-slate-500 font-medium">/ {total}</span></div>
      </div>
      <div className="w-full bg-slate-800/80 h-[4px] rounded-full overflow-hidden">
        <div className={`${color} h-full rounded-full`} style={{ width: `${(current / total) * 100}%` }} />
      </div>
    </div>
  );
}