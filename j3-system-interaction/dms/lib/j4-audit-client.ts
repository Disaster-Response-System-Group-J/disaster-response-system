import { getAuditApiBaseUrl } from '@/lib/audit-gateway';

const AUDIT_API_PATH_PREFIX = '/api/v1/audit';

type CreateAuditCaseInput = {
  eventId: string;
  incidentId: string;
  performedBy: string;
  performedRole: string;
  district: string;
  notes?: string;
  correlationId?: string;
  metadata?: string;
};

type CreateAuditCaseResult = {
  caseId: string;
  auditEventId: string;
  eventType: string;
  incidentId: string;
  transactionHash: string;
};

type LogAuditEventInput = {
  caseId: string | number;
  eventId: string;
  eventType: string;
  incidentId: string;
  resourceId?: string;
  alertId?: string;
  performedBy: string;
  performedRole: string;
  previousStatus?: string;
  newStatus?: string;
  district?: string;
  notes?: string;
  correlationId?: string;
  metadata?: string;
};

type LogAuditEventResult = {
  caseId: string;
  auditEventId: string;
  eventType: string;
  incidentId: string;
  transactionHash: string;
};

function buildAuditUrl(pathname: string) {
  const auditBaseUrl = getAuditApiBaseUrl();
  const normalizedPathname = pathname.replace(/^\/+/, '');
  const targetPathname = auditBaseUrl.endsWith(AUDIT_API_PATH_PREFIX)
    ? normalizedPathname
    : `${AUDIT_API_PATH_PREFIX}/${normalizedPathname}`;

  return new URL(targetPathname, `${auditBaseUrl}/`);
}

async function postAuditJson<T>(pathname: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(buildAuditUrl(pathname).toString(), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(result?.error || 'Failed to call J4 audit API');
  }

  return result.data;
}

export async function createAuditCase(input: CreateAuditCaseInput): Promise<CreateAuditCaseResult> {
  return postAuditJson<CreateAuditCaseResult>('/cases', {
    eventId: input.eventId,
    eventType: 'MANUAL_INCIDENT_CREATED',
    incidentId: input.incidentId,
    resourceId: null,
    alertId: null,
    performedBy: input.performedBy,
    performedRole: input.performedRole,
    previousStatus: null,
    newStatus: null,
    district: input.district,
    notes: input.notes || '',
    correlationId: input.correlationId || '',
    metadata: input.metadata || '',
  });
}

export async function logAuditEvent(input: LogAuditEventInput): Promise<LogAuditEventResult> {
  return postAuditJson<LogAuditEventResult>('/events', {
    caseId: input.caseId,
    eventId: input.eventId,
    eventType: input.eventType,
    incidentId: input.incidentId,
    resourceId: input.resourceId || '',
    alertId: input.alertId || '',
    performedBy: input.performedBy,
    performedRole: input.performedRole,
    previousStatus: input.previousStatus || '',
    newStatus: input.newStatus || '',
    district: input.district || '',
    notes: input.notes || '',
    correlationId: input.correlationId || '',
    metadata: input.metadata || '',
  });
}
