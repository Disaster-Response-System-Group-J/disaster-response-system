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

// Called by the Kafka consumer when J2 responds with the completed plan
export async function PATCH(request: Request) {
  try {
    const { planId, planData } = await request.json();
    const { rows } = await pool.query(
      `UPDATE public."ResourcePlan" SET status = 'APPROVED', plan_json = $1 WHERE plan_id = $2 RETURNING *`,
      [JSON.stringify(planData), planId]
    );
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Resource plan update error:', error);
    return NextResponse.json({ error: 'Failed to update resource plan' }, { status: 500 });
  }
}
