'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Database, FileSearch, RefreshCw, Search } from 'lucide-react';

type ManualIncidentCase = {
  caseId: string;
  auditEventId: string;
  eventId: string;
  eventType: string;
  incidentId: string;
  performedBy: string;
  performedRole: string;
  district: string;
  newStatus: string;
  notes: string;
  correlationId: string;
  timestamp: string;
};

type AuditEventRecord = {
  auditEventId: string;
  caseId: string;
  eventId: string;
  eventType: string;
  incidentId: string;
  resourceId: string;
  alertId: string;
  performedBy: string;
  performedRole: string;
  previousStatus: string;
  newStatus: string;
  district: string;
  notes: string;
  correlationId: string;
  timestamp: string;
};

type AuditCasesResponse = {
  success: boolean;
  data: {
    eventType: string;
    count: number;
    cases: ManualIncidentCase[];
  } | null;
  error: string | null;
};

type AuditEventsResponse = {
  success: boolean;
  data: {
    caseId: string;
    count: number;
    appliedFilter?: string[];
    includedEventTypes?: string[];
    events: AuditEventRecord[];
  } | null;
  error: string | null;
};

function formatTimestamp(unixTimestamp: string) {
  const parsedValue = Number(unixTimestamp);

  if (!Number.isFinite(parsedValue)) {
    return 'Not available';
  }

  return new Date(parsedValue * 1000).toLocaleString();
}

function formatEventType(eventType: string) {
  return eventType.replace(/_/g, ' ');
}

function getEventTypeStyle(eventType: string) {
  if (eventType === 'MANUAL_INCIDENT_CREATED') {
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  }

  if (eventType === 'RESOURCE_ASSIGNED' || eventType === 'RESCUE_DISPATCHED') {
    return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
  }

  if (eventType === 'INCIDENT_CLOSED') {
    return 'bg-green-500/10 text-green-400 border-green-500/20';
  }

  return 'bg-slate-800 text-slate-300 border-slate-700';
}

async function fetchAuditJson<T>(url: string) {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
  });

  const payload = (await response.json()) as T & { error?: string; success?: boolean };

  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to fetch audit data');
  }

  return payload;
}

export function AdminAuditDashboard() {
  const [auditCases, setAuditCases] = useState<ManualIncidentCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [allCaseEvents, setAllCaseEvents] = useState<AuditEventRecord[]>([]);
  const [resourceEvents, setResourceEvents] = useState<AuditEventRecord[]>([]);
  const [caseSearch, setCaseSearch] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [eventView, setEventView] = useState<'all' | 'resource'>('all');
  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [auditError, setAuditError] = useState('');

  const loadAuditCases = useCallback(async (preferredCaseId?: string) => {
    setIsLoadingCases(true);
    setAuditError('');

    try {
      const payload = await fetchAuditJson<AuditCasesResponse>('/api/audit/cases');

      if (!payload.success || !payload.data) {
        throw new Error(payload.error || 'Failed to load audit cases');
      }

      const nextCases = payload.data.cases ?? [];
      setAuditCases(nextCases);

      if (nextCases.length === 0) {
        setSelectedCaseId('');
        setAllCaseEvents([]);
        setResourceEvents([]);
        return '';
      }

      const nextSelectedCaseId =
        preferredCaseId && nextCases.some((item) => item.caseId === preferredCaseId)
          ? preferredCaseId
          : nextCases[0].caseId;

      setSelectedCaseId(nextSelectedCaseId);
      return nextSelectedCaseId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load audit cases';
      setAuditCases([]);
      setSelectedCaseId('');
      setAllCaseEvents([]);
      setResourceEvents([]);
      setAuditError(message);
      return '';
    } finally {
      setIsLoadingCases(false);
    }
  }, []);

  const loadCaseEvents = useCallback(async (caseId: string) => {
    setIsLoadingEvents(true);
    setAuditError('');

    try {
      const [allEventsPayload, resourceEventsPayload] = await Promise.all([
        fetchAuditJson<AuditEventsResponse>(`/api/audit/cases/${caseId}/events`),
        fetchAuditJson<AuditEventsResponse>(`/api/audit/cases/${caseId}/resource-events`),
      ]);

      if (!allEventsPayload.success || !allEventsPayload.data) {
        throw new Error(allEventsPayload.error || 'Failed to load case events');
      }

      if (!resourceEventsPayload.success || !resourceEventsPayload.data) {
        throw new Error(resourceEventsPayload.error || 'Failed to load resource events');
      }

      setAllCaseEvents(allEventsPayload.data.events ?? []);
      setResourceEvents(resourceEventsPayload.data.events ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load case events';
      setAllCaseEvents([]);
      setResourceEvents([]);
      setAuditError(message);
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  const refreshAuditDashboard = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const nextCaseId = await loadAuditCases(selectedCaseId);

      if (nextCaseId) {
        await loadCaseEvents(nextCaseId);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAuditCases, loadCaseEvents, selectedCaseId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAuditCases();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAuditCases]);

  useEffect(() => {
    if (!selectedCaseId) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadCaseEvents(selectedCaseId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadCaseEvents, selectedCaseId]);

  const filteredCases = useMemo(() => {
    const searchValue = caseSearch.trim().toLowerCase();

    if (!searchValue) {
      return auditCases;
    }

    return auditCases.filter((auditCase) =>
      [
        auditCase.caseId,
        auditCase.incidentId,
        auditCase.performedBy,
        auditCase.performedRole,
        auditCase.district,
        auditCase.notes,
      ]
        .join(' ')
        .toLowerCase()
        .includes(searchValue)
    );
  }, [auditCases, caseSearch]);

  const selectedCase = useMemo(
    () => auditCases.find((auditCase) => auditCase.caseId === selectedCaseId) || null,
    [auditCases, selectedCaseId]
  );

  const visibleEvents = useMemo(() => {
    const sourceEvents = eventView === 'all' ? allCaseEvents : resourceEvents;
    const searchValue = eventSearch.trim().toLowerCase();

    if (!searchValue) {
      return sourceEvents;
    }

    return sourceEvents.filter((event) =>
      [
        event.eventType,
        event.incidentId,
        event.resourceId,
        event.alertId,
        event.performedBy,
        event.performedRole,
        event.previousStatus,
        event.newStatus,
        event.district,
        event.notes,
        event.correlationId,
      ]
        .join(' ')
        .toLowerCase()
        .includes(searchValue)
    );
  }, [allCaseEvents, eventSearch, eventView, resourceEvents]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Blockchain Audit Cases</h2>
          <p className="text-sm text-slate-400">
            View immutable incident creation records and the follow-up audit trail coming from the J4 audit service.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshAuditDashboard()}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-xs font-bold text-blue-400 transition-colors hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh Audit Feed
        </button>
      </div>

      {auditError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {auditError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-800/80 bg-[#131924]">
          <div className="border-b border-slate-800/80 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-200">Current Cases</h3>
                <p className="text-xs text-slate-500">Manual incident cases recorded on-chain</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-[#0a0f16] px-3 py-1.5 text-xs font-bold text-slate-300">
                {auditCases.length}
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={caseSearch}
                onChange={(event) => setCaseSearch(event.target.value)}
                placeholder="Search case, incident, actor..."
                className="w-full rounded-lg border border-slate-800 bg-[#0a0f16] py-2 pl-9 pr-4 text-sm text-slate-200 focus:border-blue-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-[720px] overflow-y-auto p-3">
            {isLoadingCases ? (
              <div className="py-16 text-center text-sm text-slate-500">Loading audit cases...</div>
            ) : filteredCases.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">No blockchain audit cases found.</div>
            ) : (
              <div className="space-y-3">
                {filteredCases.map((auditCase) => (
                  <button
                    key={`${auditCase.caseId}-${auditCase.auditEventId}`}
                    type="button"
                    onClick={() => setSelectedCaseId(auditCase.caseId)}
                    className={`w-full rounded-xl border p-4 text-left transition-all ${
                      selectedCaseId === auditCase.caseId
                        ? 'border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/20'
                        : 'border-slate-800/80 bg-[#0a0f16] hover:border-slate-700'
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Case ID
                        </p>
                        <h4 className="text-sm font-bold text-slate-100">{auditCase.caseId}</h4>
                      </div>
                      <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold tracking-widest text-slate-300">
                        {auditCase.newStatus || 'new'}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-400">
                      <p>
                        <span className="font-semibold text-slate-200">Incident:</span> {auditCase.incidentId}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-200">District:</span>{' '}
                        {auditCase.district || 'Not provided'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-200">Created By:</span>{' '}
                        {auditCase.performedBy}
                      </p>
                      <p className="line-clamp-2 text-slate-500">{auditCase.notes || 'No notes recorded'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-800/80 bg-[#131924]">
          <div className="border-b border-slate-800/80 p-5">
            {selectedCase ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Selected Blockchain Case
                    </p>
                    <h3 className="text-xl font-bold text-slate-100">
                      Case {selectedCase.caseId} for {selectedCase.incidentId}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm text-slate-400">
                      Created by {selectedCase.performedBy} ({selectedCase.performedRole}) in{' '}
                      {selectedCase.district || 'an unspecified district'}.
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-700 bg-[#0a0f16] px-4 py-3 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Created At</p>
                    <p className="mt-1 text-xs font-semibold text-slate-200">
                      {formatTimestamp(selectedCase.timestamp)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-800 bg-[#0a0f16] p-4">
                    <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      <Database size={12} /> Total Events
                    </p>
                    <p className="text-2xl font-bold text-slate-100">{allCaseEvents.length}</p>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-[#0a0f16] p-4">
                    <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      <Activity size={12} /> Resource Events
                    </p>
                    <p className="text-2xl font-bold text-slate-100">{resourceEvents.length}</p>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-[#0a0f16] p-4">
                    <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      <FileSearch size={12} /> Correlation ID
                    </p>
                    <p className="truncate text-sm font-semibold text-slate-200">
                      {selectedCase.correlationId || 'Not provided'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex gap-2 rounded-lg border border-slate-800 bg-[#0a0f16] p-1">
                    {[
                      { id: 'all', label: 'All Events' },
                      { id: 'resource', label: 'Resource Events' },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setEventView(option.id as 'all' | 'resource')}
                        className={`rounded-md px-4 py-2 text-xs font-bold transition-colors ${
                          eventView === option.id
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full lg:max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={eventSearch}
                      onChange={(event) => setEventSearch(event.target.value)}
                      placeholder="Search event type, actor, notes..."
                      className="w-full rounded-lg border border-slate-800 bg-[#0a0f16] py-2 pl-9 pr-4 text-sm text-slate-200 focus:border-blue-500/50 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-500">
                Select a blockchain case to view its audit trail.
              </div>
            )}
          </div>

          {selectedCase && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-[#0a0f16]/60 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                    <th className="px-5 py-4">Timestamp</th>
                    <th className="px-5 py-4">Event</th>
                    <th className="px-5 py-4">Actor</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Resource / Alert</th>
                    <th className="px-5 py-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {isLoadingEvents ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-500">
                        Loading case events...
                      </td>
                    </tr>
                  ) : visibleEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-500">
                        No matching audit events for this case.
                      </td>
                    </tr>
                  ) : (
                    visibleEvents.map((event) => (
                      <tr key={event.auditEventId} className="align-top transition-colors hover:bg-slate-800/20">
                        <td className="px-5 py-4 text-xs text-slate-400">
                          <div className="whitespace-nowrap">{formatTimestamp(event.timestamp)}</div>
                          <div className="mt-1 font-mono text-[10px] text-slate-500">
                            Event #{event.auditEventId}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded border px-2 py-0.5 text-[9px] font-bold tracking-widest ${getEventTypeStyle(event.eventType)}`}
                          >
                            {formatEventType(event.eventType)}
                          </span>
                          <p className="mt-2 text-xs font-semibold text-slate-200">{event.eventId}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{event.incidentId}</p>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-300">
                          <p className="font-semibold text-slate-200">{event.performedBy}</p>
                          <p className="mt-1 text-slate-500">{event.performedRole}</p>
                          <p className="mt-1 text-slate-500">{event.district || 'District not provided'}</p>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-300">
                          <p>{event.previousStatus || 'Not set'}</p>
                          <p className="mt-1 text-slate-500">to</p>
                          <p className="mt-1 font-semibold text-slate-200">{event.newStatus || 'Not set'}</p>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-300">
                          <p>Resource: {event.resourceId || 'None'}</p>
                          <p className="mt-1">Alert: {event.alertId || 'None'}</p>
                          <p className="mt-1 text-slate-500">{event.correlationId || 'No correlation ID'}</p>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400">
                          {event.notes || 'No notes recorded'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
