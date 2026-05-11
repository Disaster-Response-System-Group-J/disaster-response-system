import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    // Fetch from IncomingReport (the richer table used by the SOS app flow)
    // Falls back to the legacy Report table if IncomingReport is empty
    const query = `
      SELECT
        ir.id            AS report_id,
        ir."source"      AS source_channel,
        ir."disasterType" AS disaster_type,
        ir.district,
        ir.latitude,
        ir.longitude,
        ir.description,
        ir.contact,
        ir."mediaUrls"   AS media_urls,
        ir."verificationStatus" AS status,
        ir."createdAt"   AS created_at,
        ir."sosId"       AS sos_id,
        ir."deviceId"    AS device_id,
        ir."officerNotes" AS officer_notes,
        ir."incidentId"  AS incident_id,
        ir."reviewedAt"  AS reviewed_at
      FROM public."IncomingReport" ir
      ORDER BY ir."createdAt" DESC
    `;
    const { rows } = await pool.query(query);

    if (rows.length > 0) {
      return NextResponse.json(rows);
    }

    // Fallback: legacy Report table
    const legacyQuery = 'SELECT * FROM public."Report" ORDER BY created_at DESC';
    const legacy = await pool.query(legacyQuery);
    return NextResponse.json(legacy.rows);
  } catch (error) {
    console.error('Failed to fetch reports:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { reportId, status, incidentId } = body;

    if (!reportId || !status) {
      return NextResponse.json({ error: 'reportId and status are required' }, { status: 400 });
    }

    // UUID Regex to determine if we are using the modern IncomingReport table
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(reportId);

    if (isUuid) {
      const query = incidentId
        ? 'UPDATE public."IncomingReport" SET "verificationStatus" = $1, "incidentId" = $2, "reviewedAt" = now() WHERE id = $3 RETURNING *'
        : 'UPDATE public."IncomingReport" SET "verificationStatus" = $1, "reviewedAt" = now() WHERE id = $2 RETURNING *';

      const params = incidentId ? [status, incidentId, reportId] : [status, reportId];
      const { rows } = await pool.query(query, params);
      return NextResponse.json(rows[0]);
    } else {
      // Fallback for legacy Report table (integer primary key)
      const legacyQuery = `
        UPDATE public."Report"
        SET status = $1, updated_at = now()
        ${incidentId ? ', incident_id = $3' : ''}
        WHERE report_id = $2
        RETURNING *
      `;
      const params = incidentId ? [status, parseInt(reportId), incidentId] : [status, parseInt(reportId)];
      const { rows } = await pool.query(legacyQuery, params);
      return NextResponse.json(rows[0] || {});
    }
  } catch (error) {
    console.error('Failed to update report:', error);
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }
}