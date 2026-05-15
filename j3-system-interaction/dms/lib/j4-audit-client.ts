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

function buildAuditUrl(pathname: string) {
  const auditBaseUrl = getAuditApiBaseUrl();
  const normalizedPathname = pathname.replace(/^\/+/, '');
  const targetPathname = auditBaseUrl.endsWith(AUDIT_API_PATH_PREFIX)
    ? normalizedPathname
    : `${AUDIT_API_PATH_PREFIX}/${normalizedPathname}`;

  return new URL(targetPathname, `${auditBaseUrl}/`);
}

export async function createAuditCase(input: CreateAuditCaseInput): Promise<CreateAuditCaseResult> {
  const response = await fetch(buildAuditUrl('/cases').toString(), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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
    }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(result?.error || 'Failed to create J4 audit case');
  }

  return result.data;
}
