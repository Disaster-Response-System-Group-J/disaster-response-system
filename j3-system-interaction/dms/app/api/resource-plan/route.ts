import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const incidentId = searchParams.get('incidentId');

    const { rows } = await pool.query(
      `SELECT * FROM public."ResourcePlan"
       ${incidentId ? 'WHERE incident_id = $1' : ''}
       ORDER BY generated_at DESC
       LIMIT 1`,
      incidentId ? [incidentId] : []
    );

    if (rows.length === 0) return NextResponse.json(null);
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Resource plan fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch resource plan' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { planId, planData, status } = await request.json();
    const nextStatus = ['DRAFT', 'APPROVED', 'EXECUTED'].includes(status) ? status : 'DRAFT';
    const { rows } = await pool.query(
      `UPDATE public."ResourcePlan"
       SET status = $1, plan_json = $2
       WHERE plan_id = $3
       RETURNING *`,
      [nextStatus, JSON.stringify(planData), planId]
    );
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Resource plan update error:', error);
    return NextResponse.json({ error: 'Failed to update resource plan' }, { status: 500 });
  }
}
