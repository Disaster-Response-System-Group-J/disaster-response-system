'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  FileSearch,
  Filter,
  RefreshCw,
  Search,
  Shield,
  Siren,
  Truck,
  User,
} from 'lucide-react';

import {
  checkJ4AuditHealth,
  getAuditTimeline,
  getResourceAuditEvents,
  listAuditCases,
  type AuditCaseSummary,
  type AuditEventRecord,
} from '@/services/j4AuditService';

const EVENT_SCOPE_OPTIONS = [
  { id: 'all', label: 'All Events' },
  { id: 'resource', label: 'Resource Events' },
] as const;

type EventScope = (typeof EVENT_SCOPE_OPTIONS)[number]['id'];

function formatTimestamp(unixTimestamp: number) {
  if (!Number.isFinite(unixTimestamp)) {
    return 'Not available';
  }

  return new Date(unixTimestamp * 1000).toLocaleString();
}

function formatEventType(eventType: string) {
  return eventType.replace(/_/g, ' ');
}

function getEventBadgeStyle(eventType: string) {
  if (eventType === 'MANUAL_INCIDENT_CREATED') {
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  }

  if (eventType === 'RESOURCE_ASSIGNED' || eventType === 'RESCUE_DISPATCHED') {
    return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
  }

  if (eventType === 'INCIDENT_CLOSED') {
    return 'bg-green-500/10 text-green-400 border-green-500/20';
  }

  if (eventType === 'INCIDENT_ESCALATED' || eventType === 'CRITICAL_ALERT_ACKNOWLEDGED') {
    return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
  }

  return 'bg-slate-800 text-slate-300 border-slate-700';
}

function EventTypeBadge({ eventType }: { eventType: string }) {
  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-[9px] font-bold tracking-widest ${getEventBadgeStyle(eventType)}`}
    >
      {formatEventType(eventType)}
    </span>
  );
}

function readMetadataSummary(metadata: string) {
  if (!metadata) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadata) as {
      table?: string;
      columns?: Record<string, unknown>;
    };

    return {
      table: parsed.table || 'metadata',
      columns: parsed.columns || {},
    };
  } catch {
    return {
      table: 'metadata',
      columns: { raw: metadata },
    };
  }
}

export function AuditorAuditDashboard() {
  const [isGatewayOnline, setIsGatewayOnline] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [auditError, setAuditError] = useState('');

  const [auditCases, setAuditCases] = useState<AuditCaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [allCaseEvents, setAllCaseEvents] = useState<AuditEventRecord[]>([]);
  const [resourceEvents, setResourceEvents] = useState<AuditEventRecord[]>([]);
  const [eventScope, setEventScope] = useState<EventScope>('all');
  const [caseSearch, setCaseSearch] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [activeEventType, setActiveEventType] = useState('');

  const loadCases = useCallback(async (preferredCaseId?: number | null) => {
    setIsLoadingCases(true);
    setAuditError('');

    try {
      const [healthOk, cases] = await Promise.all([checkJ4AuditHealth(), listAuditCases()]);
      setIsGatewayOnline(healthOk);
      setAuditCases(cases);

      if (cases.length === 0) {
        setSelectedCaseId(null);
        setSelectedEventId(null);
        setAllCaseEvents([]);
        setResourceEvents([]);
        return null;
      }

      const nextSelectedCaseId =
        preferredCaseId && cases.some((item) => item.caseId === preferredCaseId)
          ? preferredCaseId
          : cases[0].caseId;

      setSelectedCaseId(nextSelectedCaseId);
      setActiveEventType('');
      setEventSearch('');
      return nextSelectedCaseId;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load blockchain audit cases from the J4 service.';

      setAuditCases([]);
      setSelectedCaseId(null);
      setSelectedEventId(null);
      setAllCaseEvents([]);
      setResourceEvents([]);
      setIsGatewayOnline(false);
      setAuditError(message);
      return null;
    } finally {
      setIsLoadingCases(false);
    }
  }, []);

  const loadCaseEvents = useCallback(async (caseId: number) => {
    setIsLoadingEvents(true);
    setAuditError('');

    try {
      const [timelineResult, resourceTimeline] = await Promise.all([
        getAuditTimeline(caseId),
        getResourceAuditEvents(caseId),
      ]);

      setAllCaseEvents(timelineResult.events);
      setResourceEvents(resourceTimeline);

      const nextSelectedEventId = timelineResult.events[0]?.auditEventId ?? null;
      setSelectedEventId(nextSelectedEventId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load audit events for the selected case.';

      setAllCaseEvents([]);
      setResourceEvents([]);
      setSelectedEventId(null);
      setAuditError(message);
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const caseId = await loadCases(selectedCaseId);

      if (caseId != null) {
        await loadCaseEvents(caseId);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [loadCaseEvents, loadCases, selectedCaseId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCases();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadCases]);

  useEffect(() => {
    if (selectedCaseId == null) {
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
        auditCase.metadata,
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

  const scopedEvents = useMemo(
    () => (eventScope === 'all' ? allCaseEvents : resourceEvents),
    [allCaseEvents, eventScope, resourceEvents]
  );

  const eventTypeSummary = useMemo(() => {
    const summaryMap = new Map<string, number>();

    for (const event of scopedEvents) {
      summaryMap.set(event.eventType, (summaryMap.get(event.eventType) || 0) + 1);
    }

    return Array.from(summaryMap.entries())
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((left, right) => right.count - left.count);
  }, [scopedEvents]);

  const filteredEvents = useMemo(() => {
    const searchValue = eventSearch.trim().toLowerCase();

    return scopedEvents.filter((event) => {
      const matchesType = activeEventType ? event.eventType === activeEventType : true;

      if (!matchesType) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      return [
        event.eventType,
        event.eventId,
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
        event.metadata,
      ]
        .join(' ')
        .toLowerCase()
        .includes(searchValue);
    });
  }, [activeEventType, eventSearch, scopedEvents]);

  const selectedEvent = useMemo(() => {
    const matchedEvent = filteredEvents.find((event) => event.auditEventId === selectedEventId);
    return matchedEvent || filteredEvents[0] || null;
  }, [filteredEvents, selectedEventId]);

  const selectedEventMetadata = useMemo(
    () => readMetadataSummary(selectedEvent?.metadata || ''),
    [selectedEvent]
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="mx-auto max-w-[1500px] p-8">
        <div className="mb-8 flex flex-col gap-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <Database size={22} className="text-purple-400" />
              <h1 className="text-3xl font-extrabold tracking-tight">Auditor Workspace</h1>
            </div>
            <p className="max-w-3xl text-sm text-slate-400">
              Review immutable blockchain audit records, follow each case timeline, and inspect operational
              actions routed through the J4 audit service and Kong gateway.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refreshDashboard()}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/10 px-4 py-2.5 text-xs font-bold text-purple-300 transition-colors hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh Audit Data
          </button>
        </div>

        <div className="mb-6 flex items-center gap-2">
          <Shield size={12} className="text-purple-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">
            Dedicated blockchain audit view
          </span>
        </div>

        {auditError && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {auditError}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800/80 bg-[#131924] p-4">
            <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <Siren size={12} /> Gateway Status
            </p>
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isGatewayOnline === true
                    ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]'
                    : isGatewayOnline === false
                      ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]'
                      : 'bg-slate-500'
                }`}
              />
              <p className="text-lg font-bold text-slate-100">
                {isGatewayOnline === null ? 'Checking' : isGatewayOnline ? 'Online' : 'Offline'}
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-500">Kong-backed access to the J4 audit API.</p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#131924] p-4">
            <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <Database size={12} /> Audit Cases
            </p>
            <p className="text-2xl font-bold text-slate-100">{auditCases.length}</p>
            <p className="mt-2 text-xs text-slate-500">Manual incident cases available for audit review.</p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#131924] p-4">
            <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <Activity size={12} /> Visible Events
            </p>
            <p className="text-2xl font-bold text-slate-100">{filteredEvents.length}</p>
            <p className="mt-2 text-xs text-slate-500">Events currently matching your scope and filters.</p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#131924] p-4">
            <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <Truck size={12} /> Resource Actions
            </p>
            <p className="text-2xl font-bold text-slate-100">{resourceEvents.length}</p>
            <p className="mt-2 text-xs text-slate-500">Assignments and dispatch actions in the selected case.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1.4fr)_360px]">
          <section className="overflow-hidden rounded-xl border border-slate-800/80 bg-[#131924]">
            <div className="border-b border-slate-800/80 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-200">Case Library</h2>
                  <p className="text-xs text-slate-500">Blockchain manual incident cases</p>
                </div>
                <span className="rounded-lg border border-slate-700 bg-[#0a0f16] px-3 py-1.5 text-xs font-bold text-slate-300">
                  {auditCases.length}
                </span>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={caseSearch}
                  onChange={(event) => setCaseSearch(event.target.value)}
                  placeholder="Search case or incident..."
                  className="w-full rounded-lg border border-slate-800 bg-[#0a0f16] py-2 pl-9 pr-4 text-sm text-slate-200 focus:border-purple-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="max-h-[820px] overflow-y-auto p-3">
              {isLoadingCases ? (
                <div className="py-16 text-center text-sm text-slate-500">Loading audit cases...</div>
              ) : filteredCases.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-500">No audit cases available yet.</div>
              ) : (
                <div className="space-y-3">
                  {filteredCases.map((auditCase) => (
                    <button
                      key={`${auditCase.caseId}-${auditCase.auditEventId}`}
                      type="button"
                      onClick={() => {
                        setSelectedCaseId(auditCase.caseId);
                        setActiveEventType('');
                        setEventSearch('');
                      }}
                      className={`w-full rounded-xl border p-4 text-left transition-all ${
                        selectedCaseId === auditCase.caseId
                          ? 'border-purple-500/50 bg-purple-500/10 ring-1 ring-purple-500/20'
                          : 'border-slate-800/80 bg-[#0a0f16] hover:border-slate-700'
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Case</p>
                          <h3 className="text-sm font-bold text-slate-100">#{auditCase.caseId}</h3>
                        </div>
                        <EventTypeBadge eventType={auditCase.eventType} />
                      </div>

                      <div className="space-y-2 text-xs text-slate-400">
                        <p>
                          <span className="font-semibold text-slate-200">Incident:</span> {auditCase.incidentId}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-200">Created By:</span> {auditCase.performedBy}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-200">District:</span>{' '}
                          {auditCase.district || 'Not provided'}
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
                        Audit Timeline
                      </p>
                      <h2 className="text-2xl font-bold text-slate-100">
                        Case #{selectedCase.caseId} for {selectedCase.incidentId}
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm text-slate-400">
                        Created by {selectedCase.performedBy} ({selectedCase.performedRole}) in{' '}
                        {selectedCase.district || 'an unspecified district'}.
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-700 bg-[#0a0f16] px-4 py-3 text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Recorded At</p>
                      <p className="mt-1 text-xs font-semibold text-slate-200">
                        {formatTimestamp(selectedCase.timestamp)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[auto_1fr] lg:items-center">
                    <div className="flex gap-2 rounded-lg border border-slate-800 bg-[#0a0f16] p-1">
                      {EVENT_SCOPE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setEventScope(option.id);
                            setActiveEventType('');
                            setEventSearch('');
                          }}
                          className={`rounded-md px-4 py-2 text-xs font-bold transition-colors ${
                            eventScope === option.id
                              ? 'bg-purple-500/10 text-purple-300'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={eventSearch}
                        onChange={(event) => setEventSearch(event.target.value)}
                        placeholder="Search actor, status, event type, notes..."
                        className="w-full rounded-lg border border-slate-800 bg-[#0a0f16] py-2 pl-9 pr-4 text-sm text-slate-200 focus:border-purple-500/50 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      <Filter size={11} /> Event Types
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveEventType('')}
                      className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-widest transition-colors ${
                        activeEventType === ''
                          ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
                          : 'border-slate-700 bg-[#0a0f16] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ALL
                    </button>
                    {eventTypeSummary.map((item) => (
                      <button
                        key={item.eventType}
                        type="button"
                        onClick={() =>
                          setActiveEventType((currentValue) =>
                            currentValue === item.eventType ? '' : item.eventType
                          )
                        }
                        className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-widest transition-colors ${
                          activeEventType === item.eventType
                            ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
                            : 'border-slate-700 bg-[#0a0f16] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {formatEventType(item.eventType)} · {item.count}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-slate-500">
                  Select a case to inspect its blockchain timeline.
                </div>
              )}
            </div>

            <div className="max-h-[820px] overflow-y-auto p-5">
              {selectedCase && isLoadingEvents ? (
                <div className="py-20 text-center text-sm text-slate-500">Loading audit events...</div>
              ) : selectedCase && filteredEvents.length === 0 ? (
                <div className="py-20 text-center text-sm text-slate-500">
                  No audit events match the current filters.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredEvents.map((event) => {
                    const isSelected = selectedEvent?.auditEventId === event.auditEventId;

                    return (
                      <button
                        key={event.auditEventId}
                        type="button"
                        onClick={() => setSelectedEventId(event.auditEventId)}
                        className={`w-full rounded-xl border p-4 text-left transition-all ${
                          isSelected
                            ? 'border-purple-500/50 bg-purple-500/10 ring-1 ring-purple-500/20'
                            : 'border-slate-800/70 bg-[#0a0f16] hover:border-slate-700'
                        }`}
                      >
                        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <EventTypeBadge eventType={event.eventType} />
                            <div>
                              <h3 className="text-sm font-bold text-slate-100">{event.eventId}</h3>
                              <p className="text-xs text-slate-500">{event.incidentId}</p>
                            </div>
                          </div>

                          <div className="text-right text-xs text-slate-500">
                            <p className="flex items-center justify-end gap-1">
                              <Clock3 size={11} /> {formatTimestamp(event.timestamp)}
                            </p>
                            <p className="mt-1 font-mono text-[10px]">Audit #{event.auditEventId}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 text-xs text-slate-400 md:grid-cols-3">
                          <div>
                            <p className="mb-1 flex items-center gap-1 font-semibold text-slate-200">
                              <User size={11} /> Actor
                            </p>
                            <p>{event.performedBy}</p>
                            <p className="mt-1 text-slate-500">{event.performedRole}</p>
                          </div>

                          <div>
                            <p className="mb-1 font-semibold text-slate-200">Status Change</p>
                            {event.previousStatus || event.newStatus ? (
                              <p className="flex items-center gap-1">
                                <span className="text-slate-500">{event.previousStatus || 'Not set'}</span>
                                <ArrowRight size={10} className="text-slate-600" />
                                <span className="text-slate-200">{event.newStatus || 'Not set'}</span>
                              </p>
                            ) : (
                              <p className="text-slate-500">No status transition recorded</p>
                            )}
                          </div>

                          <div>
                            <p className="mb-1 font-semibold text-slate-200">District / Resource</p>
                            <p>{event.district || 'District not provided'}</p>
                            <p className="mt-1 text-slate-500">
                              {event.resourceId ? `Resource ${event.resourceId}` : 'No resource linked'}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 line-clamp-2 text-xs text-slate-500">
                          {event.notes || 'No notes recorded for this event.'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-xl border border-slate-800/80 bg-[#131924] p-5">
              <h2 className="mb-4 text-sm font-bold text-slate-200">Case Inspector</h2>

              {selectedCase ? (
                <div className="space-y-4 text-xs text-slate-400">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Case ID</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">#{selectedCase.caseId}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Incident ID</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{selectedCase.incidentId}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Created By</p>
                    <p className="mt-1">{selectedCase.performedBy}</p>
                    <p className="mt-1 text-slate-500">{selectedCase.performedRole}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Correlation ID</p>
                    <p className="mt-1 break-all">{selectedCase.correlationId || 'Not provided'}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Creation Notes</p>
                    <p className="mt-1 leading-6 text-slate-300">
                      {selectedCase.notes || 'No creation notes recorded.'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Select a case to inspect its details.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-[#131924] p-5">
              <h2 className="mb-4 text-sm font-bold text-slate-200">Selected Event</h2>

              {selectedEvent ? (
                <div className="space-y-4 text-xs text-slate-400">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <EventTypeBadge eventType={selectedEvent.eventType} />
                      <p className="mt-3 text-sm font-semibold text-slate-100">{selectedEvent.eventId}</p>
                    </div>
                    <div className="text-right text-slate-500">
                      <p>{formatTimestamp(selectedEvent.timestamp)}</p>
                      <p className="mt-1 font-mono text-[10px]">#{selectedEvent.auditEventId}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-[#0a0f16] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Actor</p>
                    <p className="mt-2 text-slate-200">{selectedEvent.performedBy}</p>
                    <p className="mt-1 text-slate-500">{selectedEvent.performedRole}</p>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-[#0a0f16] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">State Transition</p>
                    <p className="mt-2 flex items-center gap-1 text-slate-300">
                      <span>{selectedEvent.previousStatus || 'Not set'}</span>
                      <ArrowRight size={10} className="text-slate-600" />
                      <span>{selectedEvent.newStatus || 'Not set'}</span>
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-[#0a0f16] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Linked Entities</p>
                    <div className="mt-2 space-y-1">
                      <p>Resource: {selectedEvent.resourceId || 'None'}</p>
                      <p>Alert: {selectedEvent.alertId || 'None'}</p>
                      <p>Correlation: {selectedEvent.correlationId || 'None'}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-[#0a0f16] p-4">
                    <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      <FileSearch size={11} /> Audit Notes
                    </p>
                    <p className="leading-6 text-slate-300">
                      {selectedEvent.notes || 'No notes were stored for this event.'}
                    </p>
                  </div>

                  {selectedEventMetadata && (
                    <div className="rounded-lg border border-slate-800 bg-[#0a0f16] p-4">
                      <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        <Database size={11} /> DB Snapshot
                      </p>
                      <p className="mb-3 break-all text-xs font-semibold text-slate-300">
                        {selectedEventMetadata.table}
                      </p>
                      <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                        {Object.entries(selectedEventMetadata.columns).map(([key, value]) => (
                          <p key={key} className="break-all text-[11px] text-slate-500">
                            <span className="text-slate-400">{key}:</span> {String(value ?? 'null')}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Select an event to inspect the full record.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-[#131924] p-5">
              <h2 className="mb-4 text-sm font-bold text-slate-200">Audit Signals</h2>

              <div className="space-y-3">
                {eventTypeSummary.length === 0 ? (
                  <p className="text-sm text-slate-500">Event patterns will appear once a case is selected.</p>
                ) : (
                  eventTypeSummary.slice(0, 6).map((item) => (
                    <div key={item.eventType} className="rounded-lg border border-slate-800 bg-[#0a0f16] p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <EventTypeBadge eventType={item.eventType} />
                        <span className="text-xs font-bold text-slate-300">{item.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-purple-400"
                          style={{
                            width: `${scopedEvents.length === 0 ? 0 : (item.count / scopedEvents.length) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {isGatewayOnline && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs text-green-300">
                  <CheckCircle2 size={12} />
                  Kong and the J4 audit service are responding to audit queries.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
