// app/api/incidents/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createAuditCase, logAuditEvent } from '@/lib/j4-audit-client';

const DISASTER_TYPES = ['FLOOD', 'LANDSLIDE', 'DROUGHT', 'OTHER'] as const;
const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

function normalizeEnumValue<T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
  fallback: T[number]
): T[number] {
  if (typeof value !== 'string') return fallback;

  const normalizedValue = value.trim().toUpperCase();
  return allowedValues.includes(normalizedValue) ? normalizedValue : fallback;
}

function normalizeText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeNumber(value: unknown, fallback: number) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toIsoString(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function buildConfirmedIncidentMetadata(incident: Record<string, unknown>) {
  return JSON.stringify({
    table: 'public.ConfirmedIncident',
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

function getIncidentStatusAuditEventType(previousStatus: unknown, newStatus: unknown) {
  const previous = typeof previousStatus === 'string' ? previousStatus.toUpperCase() : '';
  const next = typeof newStatus === 'string' ? newStatus.toUpperCase() : '';

  if (previous === 'ACTIVE' && next === 'UNDER_RESPONSE') {
    return 'INCIDENT_ASSIGNED';
  }

  if (next === 'ESCALATED') {
    return 'INCIDENT_ESCALATED';
  }

  if (previous === 'UNDER_RESPONSE' && (next === 'RESOLVED' || next === 'CLOSED')) {
    return 'INCIDENT_CLOSED';
  }

  return null;
}

export async function GET() {
  try {
    // Simple, fast query for one table
    const query = `
      SELECT id AS incident_id, title,
             "disasterType"::text AS disaster_type, "disasterType"::text AS "disasterType",
             district, severity::text, status::text, latitude, longitude,
             description,
             "publicVisibility" AS public_visibility, "publicVisibility" AS "publicVisibility",
             "affectedPeople" AS affected_population,
             "affectedPeople" AS "affectedPeople",
             blockchain_case_id, blockchain_case_id AS "blockchainCaseId",
             "createdAt" AS created_at, "createdAt" AS "createdAt",
             "updatedAt" AS updated_at, "updatedAt" AS "updatedAt"
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
    const title = normalizeText(data.title, 'Untitled incident');
    const disasterType = normalizeEnumValue(
      data.disasterType ?? data.disaster_type ?? data.hazardType ?? data.predictionCategory,
      DISASTER_TYPES,
      'OTHER'
    );
    const severity = normalizeEnumValue(data.severity, INCIDENT_SEVERITIES, 'HIGH');
    const district = normalizeText(data.district, 'UNASSIGNED');
    const affectedPeople = normalizeNumber(data.affectedPeople ?? data.affected_population, 0);
    const latitude = normalizeNumber(data.latitude, 0);
    const longitude = normalizeNumber(data.longitude, 0);
    const description =
      typeof data.description === 'string' && data.description.trim()
        ? data.description.trim()
        : null;

    // We must insert into ConfirmedIncident to satisfy the PersonnelAssignment foreign key
    const query = `
      INSERT INTO public."ConfirmedIncident" 
      (title, severity, "affectedPeople", latitude, longitude, status, "disasterType", district, description) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING id AS incident_id, *
    `;

    const { rows } = await pool.query(query, [
      title,
      severity,
      affectedPeople,
      latitude,
      longitude,
      'ACTIVE',
      disasterType,
      district,
      description
    ]);

    const createdIncident = rows[0];

    try {
      const auditCase = await createAuditCase({
        eventId: `incident-created-${createdIncident.incident_id}-${Date.now()}`,
        incidentId: createdIncident.incident_id,
        performedBy: data.performedBy || data.createdBy || data.userId || 'j3-system',
        performedRole: data.performedRole || 'incident-api',
        district: createdIncident.district || 'UNASSIGNED',
        notes:
          data.notes ||
          `Incident created in J3: ${createdIncident.title} (${createdIncident.disasterType}, ${createdIncident.severity})`,
        correlationId: data.correlationId || data.sourceReportId || createdIncident.incident_id,
        metadata: buildConfirmedIncidentMetadata(createdIncident),
      });

      const updateQuery = `
        UPDATE public."ConfirmedIncident"
        SET blockchain_case_id = $1, "updatedAt" = now()
        WHERE id = $2
        RETURNING id AS incident_id, *
      `;
      const updatedIncident = await pool.query(updateQuery, [
        auditCase.caseId,
        createdIncident.incident_id,
      ]);

      return NextResponse.json({
        ...updatedIncident.rows[0],
        auditEventId: auditCase.auditEventId,
        auditTransactionHash: auditCase.transactionHash,
      });
    } catch (auditError) {
      console.error('J4 audit case creation failed:', auditError);
      return NextResponse.json(createdIncident);
    }
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Failed to create incident' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const data = await req.json();
    const { incidentId, status } = data;

    // Check which table the incident is in and update accordingly
    const confirmedCheck = await pool.query(
      'SELECT id AS incident_id, * FROM public."ConfirmedIncident" WHERE id = $1',
      [incidentId]
    );

    if (confirmedCheck.rows.length > 0) {
      const currentIncident = confirmedCheck.rows[0];
      const query = 'UPDATE public."ConfirmedIncident" SET status = $1, "updatedAt" = now() WHERE id = $2 RETURNING id AS incident_id, *';
      const { rows } = await pool.query(query, [status, incidentId]);
      const updatedIncident = rows[0];

      const auditEventType = getIncidentStatusAuditEventType(currentIncident.status, updatedIncident.status);
      if (auditEventType) {
        if (!currentIncident.blockchain_case_id) {
          console.warn(`Skipping J4 audit event for incident ${incidentId}: blockchain_case_id is missing`);
        } else {
          try {
            await logAuditEvent({
              caseId: currentIncident.blockchain_case_id,
              eventId: `incident-status-${incidentId}-${Date.now()}`,
              eventType: auditEventType,
              incidentId,
              performedBy: data.performedBy || data.updatedBy || data.userId || 'j3-system',
              performedRole: data.performedRole || 'incident-api',
              previousStatus: currentIncident.status || '',
              newStatus: updatedIncident.status || '',
              district: updatedIncident.district || currentIncident.district || '',
              notes:
                data.notes ||
                `Incident status changed from ${currentIncident.status} to ${updatedIncident.status}`,
              correlationId: data.correlationId || incidentId,
              metadata: JSON.stringify({
                table: 'public.ConfirmedIncident',
                action: 'PATCH /api/incidents',
                before: {
                  id: currentIncident.incident_id,
                  status: currentIncident.status,
                  blockchain_case_id: currentIncident.blockchain_case_id,
                },
                after: {
                  id: updatedIncident.incident_id,
                  status: updatedIncident.status,
                  blockchain_case_id: updatedIncident.blockchain_case_id,
                },
              }),
            });
          } catch (auditError) {
            console.warn('J4 incident status audit event failed:', auditError);
          }
        }
      }

      return NextResponse.json(rows[0]);
    } else {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Failed to update incident' }, { status: 500 });
  }
}
