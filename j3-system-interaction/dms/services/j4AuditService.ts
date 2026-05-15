import type { LogAuditEventPayload } from '@/types';

const AUDIT_PROXY_BASE = '/api/audit';

type AuditHealthResponse = {
  status?: string;
  success?: boolean;
  error?: string | null;
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

type RawAuditCase = {
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
  metadata: string;
  timestamp: string;
};

type RawAuditEvent = {
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
  metadata: string;
  timestamp: string;
};

type RawAuditCasesResponse = {
  eventType: string;
  count: number;
  cases: RawAuditCase[];
};

type RawAuditEventsResponse = {
  caseId: string;
  count: number;
  appliedFilter?: string[];
  includedEventTypes?: string[];
  events: RawAuditEvent[];
};

export type AuditCaseSummary = {
  caseId: number;
  auditEventId: number;
  eventId: string;
  eventType: string;
  incidentId: string;
  performedBy: string;
  performedRole: string;
  district: string;
  newStatus: string;
  notes: string;
  correlationId: string;
  metadata: string;
  timestamp: number;
};

export type AuditEventRecord = {
  auditEventId: number;
  caseId: number;
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
  metadata: string;
  timestamp: number;
};

export type AuditEventsResult = {
  caseId: number;
  count: number;
  appliedFilter: string[];
  events: AuditEventRecord[];
};

function toNumber(value: string | number | null | undefined) {
  const parsedValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function normalizeAuditCase(item: RawAuditCase): AuditCaseSummary {
  return {
    caseId: toNumber(item.caseId),
    auditEventId: toNumber(item.auditEventId),
    eventId: item.eventId,
    eventType: item.eventType,
    incidentId: item.incidentId,
    performedBy: item.performedBy,
    performedRole: item.performedRole,
    district: item.district || '',
    newStatus: item.newStatus || '',
    notes: item.notes || '',
    correlationId: item.correlationId || '',
    metadata: item.metadata || '',
    timestamp: toNumber(item.timestamp),
  };
}

function normalizeAuditEvent(item: RawAuditEvent): AuditEventRecord {
  return {
    auditEventId: toNumber(item.auditEventId),
    caseId: toNumber(item.caseId),
    eventId: item.eventId,
    eventType: item.eventType,
    incidentId: item.incidentId,
    resourceId: item.resourceId || '',
    alertId: item.alertId || '',
    performedBy: item.performedBy,
    performedRole: item.performedRole,
    previousStatus: item.previousStatus || '',
    newStatus: item.newStatus || '',
    district: item.district || '',
    notes: item.notes || '',
    correlationId: item.correlationId || '',
    metadata: item.metadata || '',
    timestamp: toNumber(item.timestamp),
  };
}

async function proxyFetch<T>(path: string, options?: RequestInit) {
  const response = await fetch(`${AUDIT_PROXY_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    ...options,
  });

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Audit API error: ${response.status}`);
  }

  return payload.data;
}

export async function checkJ4AuditHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${AUDIT_PROXY_BASE}/health`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as AuditHealthResponse;
    return payload.status === 'ok';
  } catch {
    return false;
  }
}

export async function logAuditEvent(payload: LogAuditEventPayload) {
  return proxyFetch('/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createAuditCase(payload: Record<string, unknown>) {
  return proxyFetch('/cases', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listAuditCases(): Promise<AuditCaseSummary[]> {
  const data = await proxyFetch<RawAuditCasesResponse>('/cases');
  return (data?.cases || []).map(normalizeAuditCase);
}

export async function getAuditTimeline(
  caseId: number,
  eventTypes: string[] = []
): Promise<AuditEventsResult> {
  const searchParams = new URLSearchParams();

  if (eventTypes.length > 0) {
    searchParams.set('eventTypes', eventTypes.join(','));
  }

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const data = await proxyFetch<RawAuditEventsResponse>(`/cases/${caseId}/events${suffix}`);

  return {
    caseId: toNumber(data?.caseId),
    count: data?.count || 0,
    appliedFilter: data?.appliedFilter || [],
    events: (data?.events || []).map(normalizeAuditEvent),
  };
}

export async function getResourceAuditEvents(caseId: number): Promise<AuditEventRecord[]> {
  const data = await proxyFetch<RawAuditEventsResponse>(`/cases/${caseId}/resource-events`);
  return (data?.events || []).map(normalizeAuditEvent);
}
