import { NextResponse } from 'next/server';
import { pool } from '@/lib/db'; // Import the Supabase pool we just created

export async function GET() {
  try {
    // Fetch all active incidents from Supabase
    const query = 'SELECT * FROM public."ActiveIncident" ORDER BY created_at DESC';
    const { rows } = await pool.query(query);
    
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const query = `
      INSERT INTO public."ActiveIncident" 
      (title, severity, affected_people, current_latitude, current_longitude, district, type, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      data.title, 
      data.severity, 
      data.affectedPeople, 
      data.latitude, 
      data.longitude, 
      data.district, 
      data.disasterType,
      'ACTIVE'
    ]);
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Failed to create incident' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { incidentId, status } = await req.json();
    const query = 'UPDATE public."ActiveIncident" SET status = $1 WHERE incident_id = $2 RETURNING *';
    const { rows } = await pool.query(query, [status, incidentId]);
    return NextResponse.json(rows[0] || {});
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Failed to update incident' }, { status: 500 });
  }
}