// app/api/incidents/dispatch/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

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
            // Removed incident_id, as it does not exist in LogisticsDeployment
            const query = `
        INSERT INTO public."LogisticsDeployment" (
          user_id, dispatched_by, status
        )
        VALUES ($1, $2, 'EN_ROUTE')
        RETURNING *
      `;
            const { rows } = await pool.query(query, [
                personnelId,
                dispatchedBy || null
            ]);

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