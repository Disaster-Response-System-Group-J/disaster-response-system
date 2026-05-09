import { NextResponse } from 'next/server';

const DEFAULT_AUDIT_GATEWAY_URL = 'http://localhost:8000';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function getAuditGatewayBaseUrl() {
  const configuredUrl =
    process.env.AUDIT_API_BASE_URL?.trim() ||
    process.env.KONG_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    DEFAULT_AUDIT_GATEWAY_URL;

  return trimTrailingSlash(configuredUrl);
}

export async function proxyAuditGet(pathname: string, searchParams?: URLSearchParams) {
  const gatewayBaseUrl = getAuditGatewayBaseUrl();
  const targetUrl = new URL(`/api/v1/audit${pathname}`, gatewayBaseUrl);

  if (searchParams) {
    targetUrl.search = searchParams.toString();
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
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
        error: 'Failed to connect to the audit API gateway',
      },
      { status: 502 }
    );
  }
}
