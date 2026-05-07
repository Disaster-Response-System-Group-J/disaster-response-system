'use client';

import { useState, useEffect } from 'react';
import Map, { Marker, NavigationControl, Popup, ViewStateChangeEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Shield, Filter, MapPin, AlertTriangle, X, ChevronDown, CheckCircle2, Clock, Link2, Database } from 'lucide-react';
import { IncidentSeverity, IncidentStatus, DISASTER_TYPES, ConfirmedIncident, UserRole, AuditEvent } from '@/types';
import { SRI_LANKA_CENTER, DISTRICT_NAMES } from '@/data/districts';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { logAuditEvent, getAuditTimeline, getResourceAuditEvents } from '@/services/j4AuditService';

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

  // Detail side panel state
  const [detailIncident, setDetailIncident] = useState<any | null>(null);
  const [auditTimeline, setAuditTimeline] = useState<AuditEvent[]>([]);
  const [resourceAuditEvents, setResourceAuditEvents] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditWarn, setAuditWarn] = useState<string | null>(null);

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
          district: 'UNASSIGNED',
          description: `Reported at ${new Date(inc.created_at).toLocaleString()}`,
          // Preserved from J1/backend — never generated in J3
          blockchainCaseId: inc.blockchain_case_id ?? null,
        }));

        setMapPins(mappedPins);
      } catch (error) {
        console.error('Error fetching incidents:', error);
      }
    };

    fetchIncidents();
  }, []);

  const handleStatusUpdate = async (incidentId: string, newStatus: IncidentStatus) => {
    const incident = mapPins.find(inc => inc.incidentId === incidentId);
    const previousStatus = incident?.status;

    // 1. Optimistic UI update
    setMapPins(prev => prev.map(inc =>
      inc.incidentId === incidentId ? { ...inc, status: newStatus } : inc
    ));
    if (selectedIncident?.incidentId === incidentId) {
      setSelectedIncident((prev: any) => ({ ...prev, status: newStatus }));
    }
    if (detailIncident?.incidentId === incidentId) {
      setDetailIncident((prev: any) => ({ ...prev, status: newStatus }));
    }

    // 2. Emit to backend
    if (socket) {
      socket.emit('client:update-incident-status', { incidentId, status: newStatus, timestamp: new Date().toISOString() });
    }

    // 3. Audit log AFTER local action succeeds — map status to event type
    const caseId: number | null = incident?.blockchainCaseId ?? null;
    const statusEventMap: Partial<Record<IncidentStatus, string>> = {
      [IncidentStatus.CLOSED]: 'INCIDENT_CLOSED',
      [IncidentStatus.RESOLVED]: 'INCIDENT_CLOSED',
    };
    // Handle escalation: if new status is ACTIVE and previous was UNDER_RESPONSE, treat as escalation
    const eventType =
      statusEventMap[newStatus] ??
      (newStatus === IncidentStatus.ACTIVE && previousStatus === IncidentStatus.UNDER_RESPONSE
        ? 'INCIDENT_ESCALATED'
        : null);

    if (caseId != null && eventType) {
      try {
        await logAuditEvent({
          caseId,
          eventId: crypto.randomUUID(),
          eventType,
          incidentId,
          performedBy: user?.id ?? 'unknown',
          performedRole: user?.role ?? 'unknown',
          previousStatus: previousStatus?.toLowerCase(),
          newStatus: newStatus.toLowerCase(),
          district: incident?.district,
        });
      } catch {
        setAuditWarn('Action completed, but blockchain audit submission failed.');
        setTimeout(() => setAuditWarn(null), 5000);
      }
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

  const openDetailPanel = async (incident: any) => {
    setDetailIncident(incident);
    setAuditTimeline([]);
    setResourceAuditEvents([]);
    setAuditError(null);

    const canViewAudit = hasPermission('view:blockchain-audit');
    if (!canViewAudit || !incident.blockchainCaseId) return;

    setAuditLoading(true);
    try {
      const [timeline, resourceEvents] = await Promise.all([
        getAuditTimeline(incident.blockchainCaseId),
        getResourceAuditEvents(incident.blockchainCaseId),
      ]);
      setAuditTimeline(timeline);
      setResourceAuditEvents(resourceEvents);
    } catch {
      setAuditError('Failed to load blockchain audit data.');
    } finally {
      setAuditLoading(false);
    }
  };

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
                <button
                  onClick={() => { openDetailPanel(selectedIncident); setSelectedIncident(null); }}
                  className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-xs font-semibold text-blue-400 transition-colors"
                >
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

      {/* Audit submission warning toast */}
      {auditWarn && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs font-semibold text-yellow-400 shadow-xl backdrop-blur-sm">
          ⚠ {auditWarn}
        </div>
      )}

      {/* Incident Detail Side Panel */}
      {detailIncident && (
        <div className="absolute inset-y-0 right-0 z-20 w-[420px] bg-[#0d1420]/98 border-l border-slate-700/60 backdrop-blur-md flex flex-col shadow-2xl overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-slate-700/50 shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="px-2 py-0.5 rounded text-[8px] font-bold tracking-widest"
                  style={{
                    backgroundColor: `${SEVERITY_COLORS[detailIncident.severity] || SEVERITY_COLORS.LOW}20`,
                    color: SEVERITY_COLORS[detailIncident.severity] || SEVERITY_COLORS.LOW,
                    border: `1px solid ${SEVERITY_COLORS[detailIncident.severity] || SEVERITY_COLORS.LOW}40`,
                  }}
                >
                  {detailIncident.severity}
                </span>
                {detailIncident.blockchainCaseId != null && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[8px] font-bold text-purple-400">
                    <Link2 size={8} /> CHAIN #{detailIncident.blockchainCaseId}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-white leading-tight">{detailIncident.title}</h2>
              <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1"><MapPin size={9} /> {detailIncident.district}</p>
            </div>
            <button onClick={() => setDetailIncident(null)} className="text-slate-400 hover:text-white shrink-0 ml-3 mt-1">
              <X size={16} />
            </button>
          </div>

          {/* Core Details */}
          <div className="p-5 border-b border-slate-700/50 space-y-3">
            <DetailRow label="Status">
              {hasPermission('update:incident-status') ? (
                <select
                  value={detailIncident.status}
                  onChange={(e) => handleStatusUpdate(detailIncident.incidentId, e.target.value as IncidentStatus)}
                  className="bg-[#0a0f16] border border-slate-700 text-xs font-semibold text-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500"
                >
                  {Object.values(IncidentStatus).map(s => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-semibold text-slate-200">{detailIncident.status.replace('_', ' ')}</span>
              )}
            </DetailRow>
            <DetailRow label="Affected People">
              <span className="text-xs font-semibold text-slate-200">{detailIncident.affectedPeople?.toLocaleString() || 'Unknown'}</span>
            </DetailRow>
            <DetailRow label="Type">
              <span className="text-xs font-semibold text-slate-200">{detailIncident.disasterType}</span>
            </DetailRow>
            <DetailRow label="Incident ID">
              <span className="text-xs font-mono text-slate-400">{detailIncident.incidentId}</span>
            </DetailRow>
            {detailIncident.description && (
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Description</p>
                <p className="text-xs text-slate-300 leading-relaxed">{detailIncident.description}</p>
              </div>
            )}
          </div>

          {/* Blockchain Audit Timeline — ADMIN / AUDITOR only */}
          {hasPermission('view:blockchain-audit') ? (
            <div className="p-5 border-b border-slate-700/50">
              <div className="flex items-center gap-2 mb-4">
                <Database size={13} className="text-purple-400" />
                <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest">Blockchain Audit Timeline</h3>
              </div>

              {detailIncident.blockchainCaseId == null ? (
                <p className="text-[11px] text-slate-500 italic">No blockchain audit case is linked to this incident.</p>
              ) : auditLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-3 h-3 border border-slate-500 border-t-purple-400 rounded-full animate-spin" />
                  Loading audit timeline…
                </div>
              ) : auditError ? (
                <p className="text-xs text-red-400">{auditError}</p>
              ) : auditTimeline.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">No audit events recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-widest">
                        <th className="pb-2 text-left font-bold">Time</th>
                        <th className="pb-2 text-left font-bold">Event</th>
                        <th className="pb-2 text-left font-bold">User</th>
                        <th className="pb-2 text-left font-bold">Status Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {auditTimeline.map((evt) => (
                        <tr key={evt.id} className="text-slate-300">
                          <td className="py-2 pr-2 text-slate-500 whitespace-nowrap">
                            {new Date(evt.timestamp * 1000).toLocaleString()}
                          </td>
                          <td className="py-2 pr-2 font-semibold text-purple-300 whitespace-nowrap">
                            {evt.eventType.replace(/_/g, ' ')}
                          </td>
                          <td className="py-2 pr-2 text-slate-400 whitespace-nowrap">
                            <div>{evt.performedBy}</div>
                            <div className="text-slate-600">{evt.performedRole}</div>
                          </td>
                          <td className="py-2 text-slate-400 whitespace-nowrap">
                            {evt.previousStatus && evt.newStatus
                              ? `${evt.previousStatus} → ${evt.newStatus}`
                              : evt.newStatus ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {auditTimeline.some(e => e.notes) && (
                    <div className="mt-3 space-y-1">
                      {auditTimeline.filter(e => e.notes).map(e => (
                        <p key={e.id} className="text-[10px] text-slate-500 italic">
                          <span className="text-slate-600">{e.eventType}:</span> {e.notes}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {/* Resource Audit History — ADMIN / AUDITOR only */}
          {hasPermission('view:blockchain-audit') && detailIncident.blockchainCaseId != null && (
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Database size={13} className="text-teal-400" />
                <h3 className="text-xs font-bold text-teal-400 uppercase tracking-widest">Resource Audit History</h3>
              </div>

              {auditLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-3 h-3 border border-slate-500 border-t-teal-400 rounded-full animate-spin" />
                  Loading…
                </div>
              ) : resourceAuditEvents.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">No resource audit events recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {resourceAuditEvents.map((evt) => (
                    <div key={evt.id} className="bg-[#131924] border border-slate-800 rounded-lg p-3 text-[10px]">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-teal-300">{evt.eventType.replace(/_/g, ' ')}</span>
                        <span className="text-slate-500">{new Date(evt.timestamp * 1000).toLocaleString()}</span>
                      </div>
                      <div className="text-slate-400">
                        {evt.resourceId && <span>Resource: <span className="text-slate-300">{evt.resourceId}</span> · </span>}
                        By: <span className="text-slate-300">{evt.performedBy}</span>
                        {evt.previousStatus && evt.newStatus && (
                          <span> · {evt.previousStatus} → {evt.newStatus}</span>
                        )}
                      </div>
                      {evt.notes && <p className="text-slate-500 italic mt-1">{evt.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
      {children}
    </div>
  );
}