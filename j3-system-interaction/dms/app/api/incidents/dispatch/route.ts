// app/api/incidents/dispatch/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { logAuditEvent } from '@/lib/j4-audit-client';

async function getIncidentForAudit(incidentId: string) {
    const { rows } = await pool.query(
        `
        SELECT id, title, district, status, blockchain_case_id
        FROM public."ConfirmedIncident"
        WHERE id = $1
        `,
        [incidentId]
    );

    return rows[0] || null;
}

async function logDispatchAuditEvent(input: {
    incidentId: string;
    personnelId: string;
    role: string;
    dispatchedBy?: string;
    resourceId?: string;
    requestId?: string;
    items?: unknown;
    dispatch: Record<string, unknown>;
}) {
    const incident = await getIncidentForAudit(input.incidentId);

    if (!incident?.blockchain_case_id) {
        console.warn(`Skipping J4 dispatch audit event for incident ${input.incidentId}: blockchain_case_id is missing`);
        return;
    }

    const eventType = input.role === 'LOGISTICS_STAFF' ? 'RESCUE_DISPATCHED' : 'INCIDENT_ASSIGNED';

    await logAuditEvent({
        caseId: incident.blockchain_case_id,
        eventId: `incident-dispatch-${input.incidentId}-${Date.now()}`,
        eventType,
        incidentId: input.incidentId,
        resourceId: input.resourceId || input.requestId || '',
        performedBy: input.dispatchedBy || 'j3-system',
        performedRole: 'dispatch-api',
        previousStatus: incident.status || '',
        newStatus: input.role === 'LOGISTICS_STAFF' ? 'dispatched' : 'assigned',
        district: incident.district || '',
        notes:
            input.role === 'LOGISTICS_STAFF'
                ? `Logistics staff ${input.personnelId} dispatched for incident ${input.incidentId}`
                : `Personnel ${input.personnelId} assigned as ${input.role} for incident ${input.incidentId}`,
        correlationId: input.requestId || input.incidentId,
        metadata: JSON.stringify({
            action: 'POST /api/incidents/dispatch',
            linkedIncident: {
                id: incident.id,
                title: incident.title,
                status: incident.status,
                blockchain_case_id: incident.blockchain_case_id,
            },
            dispatch: input.dispatch,
            personnelId: input.personnelId,
            role: input.role,
            resourceId: input.resourceId || '',
            requestId: input.requestId || '',
            items: input.items || null,
        }),
    });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { incidentId, personnelId, role, dispatchedBy } = body;

        if (!incidentId || !personnelId || !role) {
            return NextResponse.json(
                { error: 'incidentId, personnelId, and role are required' },
                { status: 400 }
            );
        }

        if (role === 'LOGISTICS_STAFF') {
            const { resourceId, requestId, items } = body;
            
            const query = `
                INSERT INTO public."LogisticsDeployment" (
                    user_id, dispatched_by, status, incident_id, resource_request_id, items_dispatched, dispatched_at
                )
                VALUES ($1, $2, 'EN_ROUTE', $3, $4, $5::jsonb, now())
                RETURNING *
            `;
            const { rows } = await pool.query(query, [
                personnelId,
                dispatchedBy || null,
                incidentId || null,
                requestId || null,
                items ? JSON.stringify(items) : null
            ]);

            // If a specific resource asset is being dispatched, update its status
            if (resourceId) {
                const assetDbId = resourceId.startsWith('ASSET-') ? resourceId.split('-')[1] : resourceId;
                await pool.query(
                    'UPDATE public."DeployableAsset" SET status = \'ASSIGNED\' WHERE asset_id = $1',
                    [assetDbId]
                );
            }

            try {
                await logDispatchAuditEvent({
                    incidentId,
                    personnelId,
                    role,
                    dispatchedBy,
                    resourceId,
                    requestId,
                    items,
                    dispatch: rows[0],
                });
            } catch (auditError) {
                console.warn('J4 logistics dispatch audit event failed:', auditError);
            }

            return NextResponse.json({ success: true, dispatch: rows[0] }, { status: 201 });

        } else {
            // Changed "role" to "assigned_role" to match your schema
            const query = `
        INSERT INTO public."PersonnelAssignment" (
          incident_id, user_id, assigned_role, status, assigned_by
        )
        VALUES ($1, $2, $3, 'ASSIGNED', $4)
        RETURNING *
      `;
            const { rows } = await pool.query(query, [
                incidentId,
                personnelId,
                role,
                dispatchedBy || null
            ]);

            try {
                await logDispatchAuditEvent({
                    incidentId,
                    personnelId,
                    role,
                    dispatchedBy,
                    dispatch: rows[0],
                });
            } catch (auditError) {
                console.warn('J4 personnel assignment audit event failed:', auditError);
            }

            return NextResponse.json({ success: true, dispatch: rows[0] }, { status: 201 });
        }
    } catch (error: any) {
        console.error('Failed to dispatch personnel:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
