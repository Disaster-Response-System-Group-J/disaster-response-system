import { httpRequestCounter, httpRequestDuration } from './metrics';
import { NextResponse } from 'next/server';

// Wrap a Next.js route handler to automatically record request count and duration.
// Usage:
// export const GET = instrumentRoute(async (req) => { ... });
export function instrumentRoute(handler: (req: Request) => Promise<Response | NextResponse> | Response | NextResponse) {
  return async (req: Request) => {
    const method = req.method || 'GET';
    const path = new URL(req.url).pathname;
    const end = httpRequestDuration.startTimer();

    try {
      const res = await handler(req as Request);
      const status = res.status;
      httpRequestCounter.inc({ method, path, status: String(status) });
      end({ method, path, status: String(status) });
      return res;
    } catch (err) {
      httpRequestCounter.inc({ method, path, status: '500' });
      end({ method, path, status: '500' });
      throw err;
    }
  };
}
