import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(): Promise<Response> {
  try {
    const query = 'SELECT * FROM public."PublicAlert" WHERE status = $1 ORDER BY issued_at DESC';
    const { rows } = await pool.query(query, ['ACTIVE']);
    
    // Map to the frontend Alert type
    const mappedAlerts = rows.map((row: any) => ({
      alertId: `ALT-${row.alert_id}`,
      title: row.title,
      description: row.message,
      severity: row.severity_level,
      type: 'PUBLIC_ALERT', // default
      district: 'ALL', // default
      isPublic: true,
      isActive: row.status === 'ACTIVE',
      createdAt: row.issued_at,
      source: 'SYSTEM'
    }));

    return NextResponse.json(mappedAlerts);
  } catch (error) {
    console.error('Database Error fetching public alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const data = await req.json();
    const query = `
      INSERT INTO public."PublicAlert" (title, message, severity_level, status) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      data.title, 
      data.description, 
      data.severity, 
      'ACTIVE'
    ]);
    return NextResponse.json({ success: true, alert: rows[0] });
  } catch (err) {
    console.error('Database Error creating alert:', err);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}