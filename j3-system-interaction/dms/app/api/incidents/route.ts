// app/api/incidents/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    // Simple, fast query for one table
    const query = `
      SELECT id AS incident_id, title, severity::text, status::text, latitude, longitude, 
             "affectedPeople" AS affected_population, "createdAt" AS created_at 
      FROM public."ConfirmedIncident" 
      ORDER BY "createdAt" DESC
    `;
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

    // We must insert into ConfirmedIncident to satisfy the PersonnelAssignment foreign key
    const query = `
      INSERT INTO public."ConfirmedIncident" 
      (title, severity, "affectedPeople", latitude, longitude, status, "disasterType", district) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING id AS incident_id, *
    `;

    const { rows } = await pool.query(query, [
      data.title,
      data.severity || 'HIGH',
      data.affectedPeople || 0,
      data.latitude || 0,
      data.longitude || 0,
      'ACTIVE',
      data.disasterType || 'UNKNOWN',
      data.district || 'UNASSIGNED'
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

    // Check which table the incident is in and update accordingly
    const confirmedCheck = await pool.query('SELECT id FROM public."ConfirmedIncident" WHERE id = $1', [incidentId]);

    if (confirmedCheck.rows.length > 0) {
      const query = 'UPDATE public."ConfirmedIncident" SET status = $1, "updatedAt" = now() WHERE id = $2 RETURNING id AS incident_id, *';
      const { rows } = await pool.query(query, [status, incidentId]);
      return NextResponse.json(rows[0]);
    } else {
      const query = 'UPDATE public."ConfirmedIncident" SET status = $1 WHERE incident_id = $2 RETURNING *';
      const { rows } = await pool.query(query, [status, incidentId]);
      return NextResponse.json(rows[0] || {});
    }
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Failed to update incident' }, { status: 500 });
  }
}