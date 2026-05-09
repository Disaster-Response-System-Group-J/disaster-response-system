import { proxyAuditHealth } from '@/lib/audit-gateway';

export async function GET() {
  return proxyAuditHealth();
}
