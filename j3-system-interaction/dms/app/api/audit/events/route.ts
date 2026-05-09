import { proxyAuditRequest } from '@/lib/audit-gateway';

export async function POST(request: Request) {
  const requestBody = await request.text();

  return proxyAuditRequest('POST', '/events', {
    body: requestBody,
    headers: {
      Accept: 'application/json',
      'Content-Type': request.headers.get('content-type') || 'application/json',
    },
  });
}
