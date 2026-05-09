import { proxyAuditGet } from '@/lib/audit-gateway';

export async function GET() {
  return proxyAuditGet('/cases');
}
