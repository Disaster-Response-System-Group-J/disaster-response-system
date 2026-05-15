import { NextResponse } from 'next/server';

const AUDIT_API_PATH_PREFIX = '/api/v1/audit';
const DEFAULT_AUDIT_API_BASE_URL = 'http://localhost:8084/api/v1/audit';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function getAuditApiBaseUrl() {
  const configuredUrl =
    process.env.AUDIT_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_AUDIT_API_BASE_URL?.trim() ||
    DEFAULT_AUDIT_API_BASE_URL;

  return trimTrailingSlash(configuredUrl);
}

function buildAuditTargetUrl(pathname: string, searchParams?: URLSearchParams) {
  const auditBaseUrl = getAuditApiBaseUrl();
  const normalizedPathname = pathname.replace(/^\/+/, '');
  const targetPathname = auditBaseUrl.endsWith(AUDIT_API_PATH_PREFIX)
    ? normalizedPathname
    : `${AUDIT_API_PATH_PREFIX}/${normalizedPathname}`;
  const targetUrl = new URL(targetPathname, `${auditBaseUrl}/`);

  if (searchParams) {
    targetUrl.search = searchParams.toString();
  }

  return targetUrl;
}

type ProxyAuditRequestOptions = {
  body?: BodyInit | null;
  headers?: HeadersInit;
  searchParams?: URLSearchParams;
};

export async function proxyAuditRequest(
  method: string,
  pathname: string,
  options: ProxyAuditRequestOptions = {}
) {
  const targetUrl = buildAuditTargetUrl(pathname, options.searchParams);

  try {
    const response = await fetch(targetUrl.toString(), {
      method,
      cache: 'no-store',
      headers: options.headers || {
        Accept: 'application/json',
      },
      body: options.body,
    });

    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || 'application/json';

    return new Response(responseText, {
      status: response.status,
      headers: {
        'content-type': contentType,
      },
    });
  } catch (error) {
    console.error('Audit API proxy error:', error);

    return NextResponse.json(
      {
        success: false,
        data: null,
        error: 'Failed to connect to the audit API',
      },
      { status: 502 }
    );
  }
}

export async function proxyAuditGet(pathname: string, searchParams?: URLSearchParams) {
  return proxyAuditRequest('GET', pathname, { searchParams });
}

export async function proxyAuditHealth() {
  const targetUrl = buildAuditTargetUrl('/cases');

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ status: 'offline' }, { status: response.status });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Audit health proxy error:', error);

    return NextResponse.json({ status: 'offline' }, { status: 502 });
  }
}
