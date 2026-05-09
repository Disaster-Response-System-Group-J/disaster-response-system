// services/j4AuditService.ts
// J3 communicates with the J4 Audit API through this module only.
// J3 never calls blockchain internals directly.

import type { LogAuditEventPayload, AuditEvent } from '@/types';

const J4_BASE_URL =
  process.env.NEXT_PUBLIC_J4_AUDIT_API_BASE_URL || 'http://localhost:8084';

interface J4Response<T = unknown> {
  success: boolean;
  data: T;
  error: string | null;
}

async function j4Fetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<J4Response<T>> {
  const res = await fetch(`${J4_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`J4 API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<J4Response<T>>;
}

/** Returns true if the J4 audit service is reachable and healthy. */
export async function checkJ4AuditHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${J4_BASE_URL}/health`);
    if (!res.ok) return false;
    const data = await res.json();
    return data?.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Log a single operational audit event to J4.
 * Should only be called AFTER the corresponding J3 action succeeds locally.
 * If the call fails, the J3 action should NOT be rolled back.
 */
export async function logAuditEvent(
  payload: LogAuditEventPayload,
): Promise<J4Response> {
  return j4Fetch('/api/v1/audit/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch the full blockchain audit timeline for an incident case.
 * Restricted to ADMIN and AUDITOR roles in the UI.
 */
export async function getAuditTimeline(caseId: number): Promise<AuditEvent[]> {
  const res = await j4Fetch<AuditEvent[]>(
    `/api/v1/audit/cases/${caseId}/events`,
  );
  return res.data ?? [];
}

/**
 * Fetch only resource-related audit events for an incident case.
 */
export async function getResourceAuditEvents(
  caseId: number,
): Promise<AuditEvent[]> {
  const res = await j4Fetch<AuditEvent[]>(
    `/api/v1/audit/cases/${caseId}/resource-events`,
  );
  return res.data ?? [];
}

/** List all audit cases tracked by J4. */
export async function listAuditCases(): Promise<J4Response> {
  return j4Fetch('/api/v1/audit/cases');
}
