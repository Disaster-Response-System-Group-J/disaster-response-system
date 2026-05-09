import type { NextRequest } from 'next/server';

import { proxyAuditGet } from '@/lib/audit-gateway';

type RouteContext = {
  params: Promise<{
    caseId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { caseId } = await context.params;

  return proxyAuditGet(`/cases/${caseId}/events`, request.nextUrl.searchParams);
}
