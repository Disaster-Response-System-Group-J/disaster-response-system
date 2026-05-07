import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    // Fetch recent dispatch records and reports
    const [dispatches, reports] = await Promise.all([
      pool.query('SELECT * FROM public."DispatchRecord" ORDER BY dispatched_at DESC LIMIT 5'),
      pool.query('SELECT * FROM public."Report" ORDER BY created_at DESC LIMIT 5')
    ]);
    
    return NextResponse.json({
      recentDispatches: dispatches.rows,
      recentReports: reports.rows
    });
  } catch (error) {
    console.error('Database Error fetching activity:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}