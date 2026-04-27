'use client';

import { useState } from 'react';
import Map, { Marker, NavigationControl, Popup, ViewStateChangeEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Shield, Filter, MapPin, AlertTriangle, X, ChevronDown, CheckCircle2, Clock } from 'lucide-react';
import { MOCK_CONFIRMED_INCIDENTS } from '@/data/mock-data';
import { IncidentSeverity, IncidentStatus, DisasterType, ConfirmedIncident } from '@/types';
import { SRI_LANKA_CENTER, DISTRICT_NAMES } from '@/data/districts';

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444', // red-500
  HIGH: '#f97316', // orange-500
  MEDIUM: '#eab308', // yellow-500
  LOW: '#3b82f6', // blue-500
};

export default function IncidentMapPage() {
  const [viewState, setViewState] = useState(SRI_LANKA_CENTER);
  const [selectedIncident, setSelectedIncident] = useState<ConfirmedIncident | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  const filteredIncidents = MOCK_CONFIRMED_INCIDENTS.filter(inc => {
    if (typeFilter !== 'ALL' && inc.disasterType !== typeFilter) return false;
    if (severityFilter !== 'ALL' && inc.severity !== severityFilter) return false;
    if (districtFilter !== 'ALL' && inc.district !== districtFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-[#0a0f16] text-white overflow-hidden relative">
      {/* Map Container */}
      <div className="absolute inset-0">
        <Map
          {...viewState}
          onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        >
          <NavigationControl position="bottom-right" />

          {/* Markers */}
          {filteredIncidents.map(inc => (
            <Marker
              key={inc.incidentId}
              longitude={inc.longitude}
              latitude={inc.latitude}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedIncident(inc);
              }}
            >
              <div className="relative cursor-pointer group">
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-lg z-10 relative transition-transform group-hover:scale-125"
                  style={{ backgroundColor: SEVERITY_COLORS[inc.severity] }}
                />
                {inc.severity === IncidentSeverity.CRITICAL && inc.status === IncidentStatus.ACTIVE && (
                  <div className="absolute inset-0 rounded-full animate-ping opacity-75" style={{ backgroundColor: SEVERITY_COLORS[inc.severity] }} />
                )}
                {/* Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full blur-sm opacity-50 z-0 pointer-events-none" style={{ backgroundColor: SEVERITY_COLORS[inc.severity] }} />
              </div>
            </Marker>
          ))}

          {/* Popup */}
          {selectedIncident && (
            <Popup
              longitude={selectedIncident.longitude}
              latitude={selectedIncident.latitude}
              anchor="bottom"
              onClose={() => setSelectedIncident(null)}
              closeButton={false}
              closeOnClick={false}
              className="z-50"
              offset={15}
            >
              <div className="bg-[#131924] border border-slate-700 rounded-xl shadow-2xl p-4 w-72 text-white font-sans">
                <div className="flex justify-between items-start mb-3">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-widest border`} style={{
                    backgroundColor: `${SEVERITY_COLORS[selectedIncident.severity]}20`,
                    borderColor: `${SEVERITY_COLORS[selectedIncident.severity]}40`,
                    color: SEVERITY_COLORS[selectedIncident.severity]
                  }}>
                    {selectedIncident.severity}
                  </span>
                  <button onClick={() => setSelectedIncident(null)} className="text-slate-400 hover:text-white transition-colors">
                    <X size={14} />
                  </button>
                </div>
                <h3 className="text-sm font-bold mb-1">{selectedIncident.title}</h3>
                <p className="text-[10px] text-slate-400 mb-3 flex items-center gap-1"><MapPin size={10} /> {selectedIncident.district}</p>
                <div className="space-y-2 mb-4 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Status</span>
                    <span className="font-semibold">{selectedIncident.status.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Affected</span>
                    <span className="font-semibold">{selectedIncident.affectedPeople?.toLocaleString() || 'Unknown'}</span>
                  </div>
                </div>
                <button className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-xs font-semibold text-blue-400 transition-colors">
                  View Full Details
                </button>
              </div>
            </Popup>
          )}
        </Map>
      </div>

      {/* Control Panel (Top Left) */}
      <div className="absolute top-6 left-6 z-10 w-80 space-y-4 pointer-events-none">
        {/* Main Panel */}
        <div className="bg-[#181f2c]/95 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden pointer-events-auto">
          <div className="p-4 border-b border-slate-700/50 flex justify-between items-center cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-blue-400" />
              <h2 className="text-sm font-bold">Map Controls</h2>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
              <Filter size={14} /> {filteredIncidents.length} shown
              <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {showFilters && (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-2 tracking-widest uppercase">DISASTER TYPE</label>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 focus:outline-none">
                  <option value="ALL">All Types</option>
                  {Object.values(DisasterType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-2 tracking-widest uppercase">SEVERITY</label>
                <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 focus:outline-none">
                  <option value="ALL">All Severities</option>
                  {Object.values(IncidentSeverity).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-2 tracking-widest uppercase">DISTRICT</label>
                <select value={districtFilter} onChange={e => setDistrictFilter(e.target.value)} className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 focus:outline-none max-h-40">
                  <option value="ALL">All Districts</option>
                  {DISTRICT_NAMES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <button onClick={() => { setTypeFilter('ALL'); setSeverityFilter('ALL'); setDistrictFilter('ALL'); }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-colors">
                Reset Filters
              </button>
            </div>
          )}
        </div>

        {/* Legend Panel */}
        <div className="bg-[#181f2c]/95 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-2xl p-4 pointer-events-auto">
          <span className="block text-[10px] font-bold text-slate-400 mb-3 tracking-widest uppercase">SEVERITY LEGEND</span>
          <div className="space-y-2 text-xs font-semibold text-slate-300">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] border-2 border-white" /> Critical</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)] border-2 border-white" /> High</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)] border-2 border-white" /> Medium</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] border-2 border-white" /> Low</div>
          </div>
        </div>
      </div>
    </div>
  );
}
