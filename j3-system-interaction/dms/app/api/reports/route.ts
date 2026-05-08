import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const query = 'SELECT * FROM public."Report" ORDER BY created_at DESC';
    const { rows } = await pool.query(query);
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { reportId, status } = await req.json();
    const query = 'UPDATE public."Report" SET status = $1 WHERE report_id = $2 RETURNING *';
    const { rows } = await pool.query(query, [status, reportId]);
    return NextResponse.json(rows[0] || {});
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }
}