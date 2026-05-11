import { proxyAuditGet } from '@/lib/audit-gateway';

type RouteContext = {
  params: Promise<{
    caseId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { caseId } = await context.params;

  return proxyAuditGet(`/cases/${caseId}/resource-events`);
}
