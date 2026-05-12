import { proxyAuditGet, proxyAuditRequest } from '@/lib/audit-gateway';

export async function GET() {
  return proxyAuditGet('/cases');
}

export async function POST(request: Request) {
  const requestBody = await request.text();

  return proxyAuditRequest('POST', '/cases', {
    body: requestBody,
    headers: {
      Accept: 'application/json',
      'Content-Type': request.headers.get('content-type') || 'application/json',
    },
  });
}
