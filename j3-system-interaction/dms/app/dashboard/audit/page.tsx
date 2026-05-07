'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Database, RefreshCw, Clock, User, ArrowRight,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, Shield,
} from 'lucide-react';
import {
  checkJ4AuditHealth,
  listAuditCases,
  getAuditTimeline,
  getResourceAuditEvents,
} from '@/services/j4AuditService';
import type { AuditEvent } from '@/types';
import AuthGuard from '@/components/auth/AuthGuard';

const EVENT_TYPE_COLORS: Record<string, string> = {
  INCIDENT_ASSIGNED:           'text-blue-400 bg-blue-500/10 border-blue-500/20',
  INCIDENT_VERIFIED:           'text-green-400 bg-green-500/10 border-green-500/20',
  FALSE_REPORT_MARKED:         'text-red-400 bg-red-500/10 border-red-500/20',
  RESOURCE_ASSIGNED:           'text-teal-400 bg-teal-500/10 border-teal-500/20',
  RESCUE_DISPATCHED:           'text-teal-400 bg-teal-500/10 border-teal-500/20',
  INCIDENT_ESCALATED:          'text-orange-400 bg-orange-500/10 border-orange-500/20',
  INCIDENT_CLOSED:             'text-slate-400 bg-slate-500/10 border-slate-500/20',
  INCIDENT_REASSIGNED:         'text-purple-400 bg-purple-500/10 border-purple-500/20',
  WARNING_OR_INSTRUCTION_ISSUED: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  CRITICAL_ALERT_ACKNOWLEDGED: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  PRIORITY_OR_SEVERITY_OVERRIDDEN: 'text-red-400 bg-red-500/10 border-red-500/20',
};

function fmtTs(ts: number) {
  return new Date(ts * 1000).toLocaleString();
}

function EventBadge({ type }: { type: string }) {
  const cls = EVENT_TYPE_COLORS[type] ?? 'text-slate-400 bg-slate-800 border-slate-700';
  return (
    <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-widest border ${cls}`}>
      {type.replace(/_/g, ' ')}
    </span>
  );
}

interface AuditCase {
  id: number;
  incidentId?: string;
  createdAt?: number;
  [key: string]: unknown;
}

function AuditDashboardContent() {
  const [j4Online, setJ4Online] = useState<boolean | null>(null);
  const [healthChecking, setHealthChecking] = useState(true);

  const [cases, setCases] = useState<AuditCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);

  const [expandedCase, setExpandedCase] = useState<number | null>(null);
  const [timelineMap, setTimelineMap] = useState<Record<number, AuditEvent[]>>({});
  const [resourceMap, setResourceMap] = useState<Record<number, AuditEvent[]>>({});
  const [timelineLoading, setTimelineLoading] = useState<number | null>(null);

  const checkHealth = useCallback(async () => {
    setHealthChecking(true);
    const ok = await checkJ4AuditHealth();
    setJ4Online(ok);
    setHealthChecking(false);
  }, []);

  const fetchCases = useCallback(async () => {
    setCasesLoading(true);
    setCasesError(null);
    try {
      const res = await listAuditCases();
      const data = Array.isArray(res.data) ? res.data : [];
      setCases(data as AuditCase[]);
    } catch {
      setCasesError('Could not load audit cases from J4. Make sure the J4 service is running.');
    } finally {
      setCasesLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth().then(() => fetchCases());
  }, [checkHealth, fetchCases]);

  const toggleCase = async (caseId: number) => {
    if (expandedCase === caseId) {
      setExpandedCase(null);
      return;
    }
    setExpandedCase(caseId);

    if (timelineMap[caseId]) return; // already loaded

    setTimelineLoading(caseId);
    try {
      const [timeline, resourceEvents] = await Promise.all([
        getAuditTimeline(caseId),
        getResourceAuditEvents(caseId),
      ]);
      setTimelineMap(prev => ({ ...prev, [caseId]: timeline }));
      setResourceMap(prev => ({ ...prev, [caseId]: resourceEvents }));
    } catch {
      setTimelineMap(prev => ({ ...prev, [caseId]: [] }));
      setResourceMap(prev => ({ ...prev, [caseId]: [] }));
    } finally {
      setTimelineLoading(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="p-8 max-w-[1200px] mx-auto">

        {/* Page Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Database size={22} className="text-purple-400" />
              <h1 className="text-3xl font-extrabold tracking-tight">Blockchain Audit Dashboard</h1>
            </div>
            <p className="text-sm text-slate-400">
              Full immutable audit trail from the J4 Blockchain Audit Service.
            </p>
          </div>
          <button
            onClick={() => { checkHealth(); fetchCases(); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-colors"
          >
            <RefreshCw size={13} className={healthChecking || casesLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* J4 Health Banner */}
        <div className={`flex items-center gap-4 px-5 py-4 rounded-xl border mb-6 ${
          j4Online === true  ? 'bg-green-500/5 border-green-500/20' :
          j4Online === false ? 'bg-red-500/5 border-red-500/20' :
          'bg-slate-800/30 border-slate-700/50'
        }`}>
          <div className={`w-3 h-3 rounded-full shrink-0 ${
            j4Online === true  ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]' :
            j4Online === false ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]' :
            'bg-slate-500 animate-pulse'
          }`} />
          <div>
            <p className="text-sm font-bold text-slate-200">
              J4 Audit Service —{' '}
              {healthChecking ? 'Checking…' : j4Online ? 'Online' : 'Offline'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {process.env.NEXT_PUBLIC_J4_AUDIT_API_BASE_URL || 'http://localhost:8084'}
            </p>
          </div>
          {j4Online === false && (
            <p className="ml-auto text-xs text-red-400 font-semibold">
              Audit data unavailable until the service is restored.
            </p>
          )}
          {j4Online === true && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-green-400 font-semibold">
              <CheckCircle2 size={13} /> Connected
            </div>
          )}
        </div>

        {/* Role badge */}
        <div className="flex items-center gap-2 mb-6">
          <Shield size={12} className="text-purple-400" />
          <span className="text-[10px] font-bold text-purple-400 tracking-widest uppercase">
            Full blockchain audit access — Auditor view
          </span>
        </div>

        {/* Audit Cases */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Audit Cases ({cases.length})
            </h2>
          </div>

          {casesLoading && (
            <div className="flex items-center gap-3 py-12 justify-center text-slate-400 text-sm">
              <RefreshCw size={16} className="animate-spin" /> Loading audit cases…
            </div>
          )}

          {casesError && (
            <div className="px-5 py-4 bg-red-500/5 border border-red-500/20 rounded-xl flex items-start gap-3">
              <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-400">Failed to load audit cases</p>
                <p className="text-xs text-slate-400 mt-1">{casesError}</p>
              </div>
            </div>
          )}

          {!casesLoading && !casesError && cases.length === 0 && (
            <div className="py-16 text-center border border-slate-800 rounded-xl">
              <Database size={28} className="text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500">No audit cases found</p>
              <p className="text-xs text-slate-600 mt-1">
                Cases are created by J1 when incidents are first reported.
              </p>
            </div>
          )}

          {cases.map((c) => {
            const isOpen = expandedCase === c.id;
            const timeline = timelineMap[c.id] ?? [];
            const resourceEvents = resourceMap[c.id] ?? [];
            const isLoadingTimeline = timelineLoading === c.id;

            return (
              <div
                key={c.id}
                className="bg-[#131924] border border-slate-800/80 rounded-xl overflow-hidden"
              >
                {/* Case Header — click to expand */}
                <button
                  onClick={() => toggleCase(c.id)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/20 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                      <Database size={14} className="text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-200">
                        Case #{c.id}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                        {c.incidentId && (
                          <span>Incident: <span className="text-slate-400">{String(c.incidentId)}</span></span>
                        )}
                        {c.createdAt && (
                          <span className="flex items-center gap-1">
                            <Clock size={9} /> {fmtTs(c.createdAt as number)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!isOpen && timelineMap[c.id] !== undefined && (
                      <span className="text-[10px] text-slate-500">{timeline.length} events</span>
                    )}
                    {isOpen ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                  </div>
                </button>

                {/* Expanded Timeline */}
                {isOpen && (
                  <div className="border-t border-slate-800/60 px-6 py-5">
                    {isLoadingTimeline ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
                        <RefreshCw size={12} className="animate-spin" /> Loading audit events…
                      </div>
                    ) : (
                      <>
                        {/* Operational Events */}
                        <h4 className="text-[9px] font-bold text-purple-400 tracking-widest uppercase mb-3">
                          Blockchain Audit Timeline
                        </h4>
                        {timeline.length === 0 ? (
                          <p className="text-xs text-slate-500 italic mb-5">No audit events recorded yet.</p>
                        ) : (
                          <div className="overflow-x-auto mb-6">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-800 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                  <th className="pb-2 text-left pr-4">Time</th>
                                  <th className="pb-2 text-left pr-4">Event</th>
                                  <th className="pb-2 text-left pr-4">Performed By</th>
                                  <th className="pb-2 text-left pr-4">Role</th>
                                  <th className="pb-2 text-left pr-4">Status Change</th>
                                  <th className="pb-2 text-left">Notes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50">
                                {timeline.map((evt) => (
                                  <tr key={evt.id} className="text-slate-300">
                                    <td className="py-2.5 pr-4 text-slate-500 whitespace-nowrap">
                                      {fmtTs(evt.timestamp)}
                                    </td>
                                    <td className="py-2.5 pr-4 whitespace-nowrap">
                                      <EventBadge type={evt.eventType} />
                                    </td>
                                    <td className="py-2.5 pr-4 whitespace-nowrap">
                                      <span className="flex items-center gap-1">
                                        <User size={10} className="text-slate-500" />
                                        {evt.performedBy}
                                      </span>
                                    </td>
                                    <td className="py-2.5 pr-4 text-slate-400 whitespace-nowrap text-[10px]">
                                      {evt.performedRole}
                                    </td>
                                    <td className="py-2.5 pr-4 whitespace-nowrap">
                                      {evt.previousStatus && evt.newStatus ? (
                                        <span className="flex items-center gap-1 text-[10px]">
                                          <span className="text-slate-500">{evt.previousStatus}</span>
                                          <ArrowRight size={9} className="text-slate-600" />
                                          <span className="text-slate-300">{evt.newStatus}</span>
                                        </span>
                                      ) : (
                                        <span className="text-slate-600">—</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 text-slate-500 italic text-[10px] max-w-[200px] truncate">
                                      {evt.notes ?? '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Resource Events */}
                        {resourceEvents.length > 0 && (
                          <>
                            <h4 className="text-[9px] font-bold text-teal-400 tracking-widest uppercase mb-3">
                              Resource Audit History
                            </h4>
                            <div className="space-y-2">
                              {resourceEvents.map((evt) => (
                                <div key={evt.id} className="flex items-start gap-3 p-3 bg-[#0a0f16] rounded-lg border border-slate-800/50">
                                  <EventBadge type={evt.eventType} />
                                  <div className="text-[10px] text-slate-400 space-y-0.5">
                                    <p>
                                      <span className="text-slate-500">By:</span> {evt.performedBy}
                                      {evt.resourceId && <> · <span className="text-slate-500">Resource:</span> {evt.resourceId}</>}
                                    </p>
                                    {evt.previousStatus && evt.newStatus && (
                                      <p className="flex items-center gap-1">
                                        <span className="text-slate-500">{evt.previousStatus}</span>
                                        <ArrowRight size={8} />
                                        {evt.newStatus}
                                      </p>
                                    )}
                                    <p className="text-slate-600">{fmtTs(evt.timestamp)}</p>
                                    {evt.notes && <p className="italic text-slate-500">{evt.notes}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AuditDashboardPage() {
  return (
    <AuthGuard requiredPermissions={['view:blockchain-audit']} fallbackUrl="/dashboard">
      <AuditDashboardContent />
    </AuthGuard>
  );
}
