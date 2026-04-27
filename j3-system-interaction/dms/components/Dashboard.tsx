"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  AlertTriangle, 
  ChevronDown, 
  TrendingUp, 
  Users, 
  Activity, 
  Truck, 
  Home, 
  CloudRain, 
  MapPin, 
  Clock, 
  ExternalLink 
} from "lucide-react";
import Map, { Marker, ViewStateChangeEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useApp } from "@/context/AppContext";

export default function Dashboard() {
  const { dashboardData, dashboardLoading, dashboardError, refreshDashboard } = useApp();
  const [viewState, setViewState] = useState({
    longitude: 80.7718, 
    latitude: 7.8731,
    zoom: 6.5,
    pitch: 0,
    bearing: 0
  });

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  return (
    <div className="flex flex-col min-h-full bg-[#0a0f16] text-white overflow-hidden">
      {/* Alert Banner */}
      <div className="bg-[#451414] border-b border-red-900/50 px-6 py-3 flex items-center gap-3 shrink-0">
        <AlertTriangle size={16} className="text-red-400" />
        <p className="text-xs font-semibold text-slate-200 flex-1 tracking-wide">
          LEVEL 3 FLOOD WARNING: KELANI RIVER BASIN (COLOMBO & GAMPAHA DISTRICTS) - EVACUATION ORDERS ACTIVE
        </p>
        <button className="text-xs text-red-300 hover:text-red-200 font-semibold whitespace-nowrap transition-colors">
          View Details
        </button>
      </div>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">Operational Overview</p>
              <h1 className="text-4xl font-extrabold tracking-tight">National Status</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <FilterButton label="District: All" />
              <FilterButton label="Disaster Type" />
              <FilterButton label="Severity" />
            </div>
          </div>

          {dashboardLoading && (
            <div className="text-center py-24 text-slate-400 font-medium">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              Synchronizing Command Data...
            </div>
          )}

          {dashboardError && (
            <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-6 mb-8 text-center text-red-300">
              Connection Error: {dashboardError}
            </div>
          )}

          {dashboardData && (
            <div className="space-y-6">
              {/* Top Row */}
              <div className="grid grid-cols-4 gap-6">
                
                {/* Active Incidents */}
                <div className="col-span-2 bg-[#131924] border border-slate-800/80 rounded-xl p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">ACTIVE INCIDENTS</span>
                    <Activity className="text-red-400 w-4 h-4" />
                  </div>
                  
                  <div className="flex items-baseline gap-4 my-4">
                    <span className="text-6xl font-bold tracking-tight">{dashboardData.activeIncidents}</span>
                    <span className="text-xs font-bold text-red-400 flex items-center bg-red-400/10 px-2 py-1 rounded">
                      <TrendingUp className="w-3 h-3 mr-1"/> +{dashboardData.activeIncidentsChange} in 24h
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-800/50">
                    <Breakdown label="FLOODS" value={dashboardData.incidents.floods} />
                    <Breakdown label="LANDSLIDES" value={dashboardData.incidents.landslides} />
                    <Breakdown label="OTHER" value={dashboardData.incidents.other} />
                  </div>
                </div>

                {/* Critical Alerts */}
                <div className="col-span-1 bg-[#131924] border border-slate-800/80 rounded-xl p-6 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-6 right-6 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]"></div>
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">CRITICAL ALERTS</span>
                  <span className="text-6xl font-bold text-red-400 tracking-tight my-4">
                    {String(dashboardData.criticalAlerts).padStart(2, '0')}
                  </span>
                  <button className="w-full py-2.5 bg-slate-800/50 hover:bg-slate-700/80 border border-slate-700/50 rounded-lg text-xs font-semibold text-slate-200 transition-colors">
                    Review Alerts
                  </button>
                </div>

                {/* People Affected */}
                <div className="col-span-1 bg-[#131924] border border-slate-800/80 rounded-xl p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase leading-relaxed">PEOPLE AFFECTED<br/>(EST)</span>
                    <Users className="text-slate-500 w-4 h-4" />
                  </div>
                  <span className="text-5xl font-bold tracking-tight my-4">
                    {(dashboardData.peopleAffected / 1000).toFixed(1)}K
                  </span>
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-400 mb-2">
                      <span>In Shelters</span>
                      <span className="text-white">{dashboardData.inShelters.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${(dashboardData.inShelters / dashboardData.peopleAffected) * 100}%` }}></div>
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
                    <ResourceBar title="Available Teams" current={dashboardData.resources.availableTeams.current} total={dashboardData.resources.availableTeams.total} icon={<Users size={12}/>} color="bg-blue-400" />
                    <ResourceBar title="Active Shelters" current={dashboardData.resources.activeShelters.current} total={dashboardData.resources.activeShelters.total} icon={<Home size={12}/>} color="bg-teal-400" />
                    <ResourceBar title="Heavy Machinery" current={dashboardData.resources.heavyMachinery.current} total={dashboardData.resources.heavyMachinery.total} icon={<Truck size={12}/>} color="bg-slate-400" />
                  </div>
                  <button className="w-full mt-8 py-2.5 bg-slate-800/50 hover:bg-slate-700/80 border border-slate-700/50 rounded-lg text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-2">
                    <Truck size={14} className="text-slate-400" /> Resource Tracking
                  </button>
                </div>

                {/* Live Interactive Map */}
                <div className="col-span-2 bg-[#131924] border border-slate-800/80 rounded-xl overflow-hidden relative min-h-[320px]">
                  <Map
                    {...viewState}
                    onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
                    mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                  >
                    <Marker longitude={80.22} latitude={6.05} anchor="center">
                      <div className="w-2.5 h-2.5 bg-blue-300 rounded-full shadow-[0_0_15px_rgba(147,197,253,0.8)]"></div>
                    </Marker>
                    <Marker longitude={79.86} latitude={6.93} anchor="center">
                      <div className="w-3 h-3 rounded-full border-2 border-red-500 bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.6)]"></div>
                    </Marker>
                  </Map>

                  <div className="absolute top-6 right-6 w-52 bg-[#181f2c]/95 backdrop-blur-md border border-slate-700/60 rounded-xl p-5 shadow-2xl">
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest block mb-4 uppercase">MAP LAYERS</span>
                    <div className="space-y-3.5 mb-6">
                      <Checkbox label="Flood Zones" color="bg-blue-400" defaultChecked />
                      <Checkbox label="Incidents" color="bg-red-400" defaultChecked />
                      <Checkbox label="Shelters" color="bg-slate-600" />
                    </div>
                    <button className="w-full py-2 bg-slate-800/60 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-colors flex justify-center items-center gap-2">
                      Full Map <ExternalLink size={12} className="text-slate-400" />
                    </button>
                  </div>
                </div>

              </div>

              {/* Bottom Row */}
              <div className="grid grid-cols-3 gap-6">
                
                {/* Monsoon Pattern */}
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
                  <div className="flex gap-2">
                    <RiskZone label="Ratnapura" />
                    <RiskZone label="Kalutara" />
                    <RiskZone label="Colombo" active />
                  </div>
                </div>

                {/* High Priority Incidents */}
                <div className="col-span-2 bg-[#131924] border border-slate-800/80 rounded-xl p-6">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">HIGH PRIORITY INCIDENTS</span>
                    <button className="text-xs text-slate-400 hover:text-white font-semibold transition-colors">View All</button>
                  </div>
                  <div className="space-y-2">
                    {dashboardData.alerts.map(alert => (
                      <IncidentRow 
                        key={alert.id}
                        title={alert.title} 
                        location={alert.location} 
                        time={alert.time} 
                        severity={alert.severity.toUpperCase()} 
                      />
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FilterButton({ label }: { label: string }) {
  return (
    <button className="flex items-center gap-2 px-4 py-2.5 bg-[#131924] border border-slate-800/80 hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-300 transition-colors">
      {label} <ChevronDown size={14} className="text-slate-500" />
    </button>
  );
}

function Breakdown({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-500 tracking-widest mb-1 uppercase">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function ResourceBar({ title, current, total, icon, color }: { title: string; current: number; total: number; icon: React.ReactNode; color: string }) {
  const percentage = (current / total) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="text-slate-400">{icon}</div>
          <span className="text-xs font-semibold text-slate-300">{title}</span>
        </div>
        <div className="text-xs font-bold text-white">
          {current} <span className="text-slate-500 font-medium">/ {total}</span>
        </div>
      </div>
      <div className="w-full bg-slate-800/80 h-[4px] rounded-full overflow-hidden">
        <div className={`${color} h-full rounded-full`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}

function Checkbox({ label, color, defaultChecked = false }: { label: string; color: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative flex items-center justify-center">
        <input 
          type="checkbox" 
          defaultChecked={defaultChecked}
          className={`peer appearance-none w-4 h-4 border border-slate-600 bg-slate-800/50 rounded-[4px] checked:${color} checked:border-transparent transition-colors cursor-pointer`}
        />
        <svg className="absolute w-2.5 h-2.5 pointer-events-none hidden peer-checked:block text-[#0a0f16]" viewBox="0 0 14 10" fill="none">
          <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">{label}</span>
    </label>
  );
}

function RiskZone({ label, active }: { label: string; active?: boolean }) {
  return (
    <span className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${
      active 
        ? "bg-red-900/40 text-red-300 border-red-800/50" 
        : "bg-slate-800/80 text-slate-300 border-slate-700/50"
    }`}>
      {label}
    </span>
  );
}

function IncidentRow({ title, location, time, severity }: { title: string; location: string; time: string; severity: string }) {
  const isCritical = severity === "CRITICAL";
  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/30 transition-colors border border-transparent hover:border-slate-800/50">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isCritical ? "bg-red-500/10" : "bg-blue-500/10"}`}>
          <AlertTriangle size={16} className={isCritical ? "text-red-400" : "text-blue-400"} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-200 mb-1">{title}</h4>
          <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500">
            <span className="flex items-center gap-1"><MapPin size={10} /> {location}</span>
            <span className="flex items-center gap-1"><Clock size={10} /> {time}</span>
          </div>
        </div>
      </div>
      <span className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border ${
        isCritical 
          ? "bg-red-500/20 text-red-400 border-red-500/30" 
          : "bg-slate-800 text-slate-300 border-slate-700"
      }`}>
        {severity}
      </span>
    </div>
  );
}