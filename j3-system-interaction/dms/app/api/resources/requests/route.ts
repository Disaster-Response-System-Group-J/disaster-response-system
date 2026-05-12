import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

/**
 * GET /api/resources/requests
 * Fetch all resource requests submitted by response teams.
 * Joins with ConfirmedIncident and User for display context.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const incidentId = searchParams.get('incidentId');
  const status = searchParams.get('status');

  try {
    let query = `
      SELECT
        rr.request_id,
        rr.incident_id,
        ci.title            AS incident_title,
        ci.district         AS incident_district,
        rr.requested_by,
        u.name              AS requester_name,
        u.role              AS requester_role,
        rr.created_at,
        rr.status,
        rr.items,
        rr.notes,
        rr.reviewed_by,
        ru.name             AS reviewer_name,
        rr.reviewed_at
      FROM public."ResourceRequest" rr
      LEFT JOIN public."ConfirmedIncident" ci ON ci.id = rr.incident_id
      LEFT JOIN public."User" u ON u.id = rr.requested_by
      LEFT JOIN public."User" ru ON ru.id = rr.reviewed_by
      WHERE 1=1
    `;
    const params: any[] = [];

    if (incidentId) {
      params.push(incidentId);
      query += ` AND rr.incident_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND rr.status = $${params.length}`;
    }

    query += ' ORDER BY rr.created_at DESC';

    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch resource requests:', error);
    return NextResponse.json({ error: 'Failed to fetch resource requests' }, { status: 500 });
  }
}

/**
 * POST /api/resources/requests
 * Create a new resource request (submitted by a response team member via the web or mobile).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { incidentId, requestedBy, items, notes } = body;

    if (!incidentId || !requestedBy || !items?.length) {
      return NextResponse.json(
        { error: 'incidentId, requestedBy, and items are required' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO public."ResourceRequest"
        (incident_id, requested_by, items, notes, status, created_at)
      VALUES ($1, $2, $3::jsonb, $4, 'PENDING', now())
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      incidentId,
      requestedBy,
      JSON.stringify(items),
      notes || null,
    ]);

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error('Failed to create resource request:', error);
    return NextResponse.json({ error: 'Failed to create resource request' }, { status: 500 });
  }
}

/**
 * PATCH /api/resources/requests
 * Update the status of a resource request (approve / dispatch / fulfill).
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { requestId, status, reviewedBy } = body;

    if (!requestId || !status) {
      return NextResponse.json({ error: 'requestId and status are required' }, { status: 400 });
    }

    const validStatuses = ['PENDING', 'APPROVED', 'DISPATCHED', 'FULFILLED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const query = `
      UPDATE public."ResourceRequest"
      SET status = $1, reviewed_by = $2, reviewed_at = now()
      WHERE request_id = $3
      RETURNING *
    `;
    const { rows } = await pool.query(query, [status, reviewedBy || null, requestId]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Resource request not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Failed to update resource request:', error);
    return NextResponse.json({ error: 'Failed to update resource request' }, { status: 500 });
  }
}
