import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createAuditCase } from "@/lib/j4-audit-client";

function toIsoString(value: unknown) {
  return value instanceof Date ? value.toISOString() : (value ?? null);
}

function buildConfirmedIncidentMetadata(incident: Record<string, unknown>) {
  return JSON.stringify({
    table: "public.ConfirmedIncident",
    columns: {
      id: incident.id ?? incident.incident_id,
      title: incident.title,
      disasterType: incident.disasterType,
      district: incident.district,
      severity: incident.severity,
      status: incident.status,
      latitude: incident.latitude,
      longitude: incident.longitude,
      description: incident.description,
      publicVisibility: incident.publicVisibility,
      affectedPeople: incident.affectedPeople,
      createdAt: toIsoString(incident.createdAt),
      updatedAt: toIsoString(incident.updatedAt),
      division_id: incident.division_id,
      blockchain_case_id: incident.blockchain_case_id,
    },
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

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
      ORDER BY 
        CASE WHEN ir."verificationStatus" = 'PENDING_REVIEW' THEN 0 ELSE 1 END,
        ir."createdAt" DESC
    `;
    const { rows } = await pool.query(query);

    if (rows.length > 0) {
      return NextResponse.json(rows);
    }

    // Fallback: legacy Report table
    const legacyQuery =
      'SELECT * FROM public."Report" ORDER BY created_at DESC';
    const legacy = await pool.query(legacyQuery);
    return NextResponse.json(legacy.rows);
  } catch (error) {
    console.error("Failed to fetch reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { reportId, status, reviewedBy } = body;

    if (!reportId || !status) {
      return NextResponse.json(
        { error: "reportId and status are required" },
        { status: 400 },
      );
    }

    if (typeof reportId !== "string" || !isUuid(reportId)) {
      return NextResponse.json(
        { error: "reportId must be a valid IncomingReport UUID" },
        { status: 400 },
      );
    }

    await client.query("BEGIN");

    // 1. Fetch the report data to populate the incident
    const reportQuery = 'SELECT * FROM public."IncomingReport" WHERE id = $1';
    const reportRes = await client.query(reportQuery, [reportId]);

    if (reportRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const report = reportRes.rows[0];
    let createdIncidentId = null;
    let createdIncident = null;

    // 2. If status is VERIFIED, create the ConfirmedIncident
    if (status === "VERIFIED") {
      const incidentQuery = `
        INSERT INTO public."ConfirmedIncident" 
        (title, "disasterType", district, severity, status, latitude, longitude, description, "affectedPeople")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id AS incident_id, *
      `;

      // Defaulting values from the report; severity is defaulted to 'MEDIUM' if missing
      const incidentValues = [
        `Reported ${report.disasterType}: ${report.district}`,
        report.disasterType,
        report.district,
        "MEDIUM",
        "ACTIVE",
        report.latitude,
        report.longitude,
        report.description,
        0,
      ];

      const incidentRes = await client.query(incidentQuery, incidentValues);
      createdIncident = incidentRes.rows[0];
      createdIncidentId = createdIncident.incident_id;
    }

    // 3. Update the IncomingReport with new status and the link to the incident
    const updateReportQuery = `
      UPDATE public."IncomingReport"
      SET "verificationStatus" = $1, 
          "incidentId" = $2, 
          "reviewedById" = $3, 
          "reviewedAt" = now()
      WHERE id = $4
      RETURNING *
    `;
    const updatedReportRes = await client.query(updateReportQuery, [
      status,
      createdIncidentId || report.incidentId,
      reviewedBy || null,
      reportId,
    ]);

    await client.query("COMMIT");

    const updatedReport = updatedReportRes.rows[0];

    if (!createdIncident) {
      return NextResponse.json(updatedReport);
    }

    try {
      const auditCase = await createAuditCase({
        eventId: `report-verified-${reportId}-${Date.now()}`,
        incidentId: createdIncident.incident_id,
        performedBy: reviewedBy || "j3-system",
        performedRole: "report-review-api",
        district: createdIncident.district || "UNASSIGNED",
        notes: `Incoming report ${reportId} verified and converted into incident ${createdIncident.incident_id}`,
        correlationId: reportId,
        metadata: buildConfirmedIncidentMetadata(createdIncident),
      });

      await pool.query(
        `UPDATE public."ConfirmedIncident"
         SET blockchain_case_id = $1, "updatedAt" = now()
         WHERE id = $2`,
        [auditCase.caseId, createdIncident.incident_id],
      );

      return NextResponse.json({
        ...updatedReport,
        blockchain_case_id: auditCase.caseId,
        auditEventId: auditCase.auditEventId,
        auditTransactionHash: auditCase.transactionHash,
      });
    } catch (auditError) {
      console.error(
        "J4 audit case creation failed for verified report:",
        auditError,
      );
      return NextResponse.json(updatedReport);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to verify report and create incident:", error);
    return NextResponse.json(
      { error: "Failed to process verification" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
