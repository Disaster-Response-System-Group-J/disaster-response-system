import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qfhmczryyyddgitnlndy.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmaG1jenJ5eXlkZGdpdG5sbmR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDA1NTAsImV4cCI6MjA5MjkxNjU1MH0.T7ncUD48wnQtb5PGasWpLEZjG6Y5PQz_QCfurE6DPs4';

export async function GET() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/IncomingReport?select=*&order=createdAt.desc`,
      {
        cache: 'no-store',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!response.ok) throw new Error(`Supabase responded with ${response.status}`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}
