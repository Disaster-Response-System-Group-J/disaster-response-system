// app/api/incidents/[id]/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // Await params for Next.js 15+ compatibility
) {
  const { id } = await params;

  // Validation: Ensure ID is a valid UUID to prevent Postgres errors
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: 'Invalid Incident ID format' }, { status: 400 });
  }

  try {
    // 1. Fetch Incident Details
    const incidentQuery = `
      SELECT 
        id AS incident_id, title, severity::text, status::text, 
        latitude, longitude, "affectedPeople" AS affected_population, 
        "disasterType", district, description,
        "createdAt" AS created_at, "updatedAt" AS updated_at
      FROM public."ConfirmedIncident"
      WHERE id = $1
    `;
    const incidentResult = await pool.query(incidentQuery, [id]);

    if (incidentResult.rows.length > 0) {
      const incident = incidentResult.rows[0];

      // 2. Fetch Personnel
      // Note: We use COALESCE/fallback for Logistics if the table is still being created
      // app/api/incidents/[id]/route.ts

      const personnelQuery = `
  SELECT 
    pa.assignment_id AS unique_entry_id, -- Use the specific assignment ID
    u.id AS user_id, 
    u.name, 
    u.role::text, 
    u.email,
    pa.assigned_role,
    pa.status AS assignment_status,
    pa.assigned_at
  FROM public."PersonnelAssignment" pa
  JOIN public."User" u ON pa.user_id = u.id
  WHERE pa.incident_id = $1
  
  UNION ALL
  
  SELECT 
    ld.deployment_id AS unique_entry_id, -- Use the specific deployment ID
    u.id AS user_id, 
    u.name, 
    u.role::text, 
    u.email,
    'LOGISTICS' AS assigned_role,
    ld.status AS assignment_status,
    ld.dispatched_at AS assigned_at
  FROM public."LogisticsDeployment" ld
  JOIN public."User" u ON ld.user_id = u.id
  WHERE ld.incident_id = $1
`;
      const personnelResult = await pool.query(personnelQuery, [id]);

      return NextResponse.json({
        ...incident,
        personnel: personnelResult.rows
      });
    }

    // 3. Fallback to Incoming Reports
    const reportQuery = 'SELECT id AS incident_id, ... FROM public."IncomingReport" WHERE id = $1';
    // ... existing fallback logic

    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}