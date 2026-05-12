import { NextResponse } from 'next/server';

const J2_API_URL = process.env.J2_API_URL || 'http://localhost:8082';

export async function GET() {
  try {
    const response = await fetch(`${J2_API_URL}/api/v1/sos-requests?limit=200`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`J2 API responded with ${response.status}`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch reports from J2:', error);
    return NextResponse.json([], { status: 200 });
  }
}
