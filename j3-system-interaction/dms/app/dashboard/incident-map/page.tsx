'use client';

import { useState, useEffect } from 'react';
import Map, { Marker, NavigationControl, Popup, ViewStateChangeEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Shield, Filter, MapPin, AlertTriangle, X, ChevronDown, CheckCircle2, Clock } from 'lucide-react';
import { IncidentSeverity, IncidentStatus, DISASTER_TYPES, ConfirmedIncident, UserRole } from '@/types';
import { SRI_LANKA_CENTER, DISTRICT_NAMES } from '@/data/districts';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444', 
  HIGH: '#f97316', 
  MEDIUM: '#eab308', 
  LOW: '#3b82f6', 
  PENDING: '#a855f7', // Add a purple color for unverified incoming reports
};

export default function IncidentMapPage() {
  const { user, hasPermission} = useAuth();
  const socket = useSocket();

  const [viewState, setViewState] = useState(SRI_LANKA_CENTER);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  
  // Start with an empty array instead of mock data
  const [mapPins, setMapPins] = useState<any[]>([]);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  const enforcedDistrict = (user?.role === UserRole.SYSTEM_ADMIN || user?.role.includes('NATIONAL')) ? 'ALL' : (user as any)?.assignedDistrict || 'ALL';

  // Fetch initial data from database
  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const response = await fetch('/api/incidents');
        if (!response.ok) throw new Error('Failed to fetch incidents');
        
        const data = await response.json();
        
        // Map database schema to the UI's expected format
        const mappedPins = data.map((inc: any) => ({
          incidentId: inc.incident_id.toString(),
          title: inc.title,
          disasterType: inc.title?.toUpperCase().includes('FLOOD') ? 'FLOOD' : 
                        inc.title?.toUpperCase().includes('LANDSLIDE') ? 'LANDSLIDE' : 'UNKNOWN',
          severity: inc.severity || 'LOW',
          status: inc.status || 'ACTIVE',
          latitude: Number(inc.latitude) || 0,
          longitude: Number(inc.longitude) || 0,
          affectedPeople: inc.affected_population || 0,
          district: 'UNASSIGNED', // Fallback, could map from division_id if joined in API
          description: `Reported at ${new Date(inc.created_at).toLocaleString()}`
        }));

        setMapPins(mappedPins);
      } catch (error) {
        console.error('Error fetching incidents:', error);
      }
    };

    fetchIncidents();
  }, []);

  const handleStatusUpdate = (incidentId: string, newStatus: IncidentStatus) => {
    // Optimistic UI update
    setMapPins(prev => prev.map(inc => 
      inc.incidentId === incidentId ? { ...inc, status: newStatus } : inc
    ));
    
    if (selectedIncident?.incidentId === incidentId) {
      setSelectedIncident({ ...selectedIncident, status: newStatus });
    }

    // Emit to backend
    if (socket) {
      socket.emit('client:update-incident-status', { incidentId, status: newStatus, timestamp: new Date().toISOString() });
    }
  };

  // Listen for incoming reports to drop new pins
  useEffect(() => {
    if (!socket) return;

    const handleNewReport = (report: any) => {
      // Ensure the report has coordinates before mapping it
      if (report.latitude && report.longitude) {
        const newPin = {
          incidentId: report.reportId,
          disasterType: report.disasterType,
          severity: 'PENDING', // Assign our new custom severity
          status: 'UNVERIFIED',
          latitude: report.latitude,
          longitude: report.longitude,
          title: `SOS Report: ${report.disasterType}`,
          district: report.district,
          description: report.description
        };
        
        setMapPins(prev => [...prev, newPin]);
      }
    };

    socket.on('dashboard:new-report', handleNewReport);

    return () => {
      socket.off('dashboard:new-report', handleNewReport);
    };
  }, [socket]);

  const filteredIncidents = mapPins.filter(inc => {
    if (typeFilter !== 'ALL' && inc.disasterType !== typeFilter) return false;
    if (severityFilter !== 'ALL' && inc.severity !== severityFilter) return false;
    if (districtFilter !== 'ALL' && inc.district !== districtFilter) return false;
    if (enforcedDistrict !== 'ALL' && inc.district !== enforcedDistrict) return false;
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
                  style={{ backgroundColor: SEVERITY_COLORS[inc.severity] || SEVERITY_COLORS.LOW }}
                />
                {inc.severity === IncidentSeverity.CRITICAL && inc.status === IncidentStatus.ACTIVE && (
                  <div className="absolute inset-0 rounded-full animate-ping opacity-75" style={{ backgroundColor: SEVERITY_COLORS[inc.severity] }} />
                )}
                {/* Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full blur-sm opacity-50 z-0 pointer-events-none" style={{ backgroundColor: SEVERITY_COLORS[inc.severity] || SEVERITY_COLORS.LOW }} />
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
                    backgroundColor: `${SEVERITY_COLORS[selectedIncident.severity] || SEVERITY_COLORS.LOW}20`,
                    borderColor: `${SEVERITY_COLORS[selectedIncident.severity] || SEVERITY_COLORS.LOW}40`,
                    color: SEVERITY_COLORS[selectedIncident.severity] || SEVERITY_COLORS.LOW
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
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="text-slate-500">Status</span>
                    {hasPermission('update:incident-status') ? (
                      <select 
                        value={selectedIncident.status}
                        onChange={(e) => handleStatusUpdate(selectedIncident.incidentId, e.target.value as IncidentStatus)}
                        className="bg-[#0a0f16] border border-slate-700 text-xs font-semibold text-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500 cursor-pointer"
                      >
                        {Object.values(IncidentStatus).map(s => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-semibold">{selectedIncident.status.replace('_', ' ')}</span>
                    )}
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
          
          {/* Add the restriction badge right below the Map Controls header if restricted */}
          {enforcedDistrict !== 'ALL' && (
            <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2 flex items-center justify-center gap-2 text-[10px] font-bold text-blue-400 tracking-widest uppercase">
              <MapPin size={12} /> Restricted to {enforcedDistrict}
            </div>
          )}

          {showFilters && (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-2 tracking-widest uppercase">DISASTER TYPE</label>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 focus:outline-none">
                  <option value="ALL">All Types</option>
                  {Object.values(DISASTER_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
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