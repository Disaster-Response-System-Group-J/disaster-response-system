import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const J2_BASE_URL = process.env.J2_DATA_INTELLIGENCE_URL ?? 'http://localhost:8082';
const J2_REQUEST_TIMEOUT_MS = 60_000;

async function saveResourcePlan({
  incidentId,
  requestedBy,
  planData,
  divisionsAnalyzed,
}: {
  incidentId: string | null;
  requestedBy: string | null;
  planData: unknown;
  divisionsAnalyzed: number | null;
}) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO public."ResourcePlan"
        (incident_id, requested_by, status, plan_json, divisions_analyzed)
       VALUES ($1, $2, 'DRAFT', $3, $4)
       RETURNING *`,
      [incidentId, requestedBy, JSON.stringify(planData), divisionsAnalyzed]
    );
    return rows[0];
  } catch (error) {
    console.warn('ResourcePlan insert skipped:', error);
    return {
      plan_id: randomUUID(),
      incident_id: incidentId,
      requested_by: requestedBy,
      generated_at: new Date().toISOString(),
      status: 'DRAFT',
      plan_json: planData,
      divisions_analyzed: divisionsAnalyzed,
    };
  }
}

export async function POST(request: Request) {
  try {
    const { incidentId, triggeredBy, adminDecisions, targetDate } = await request.json();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), J2_REQUEST_TIMEOUT_MS);

    let j2Response: Response;
    try {
      j2Response = await fetch(`${J2_BASE_URL}/api/v1/intelligence/agent/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_decisions: adminDecisions ?? '',
          target_date: targetDate ?? null,
        }),
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      return NextResponse.json(
        {
          error: isTimeout
            ? 'J2 allocation agent timed out while generating the resource plan'
            : 'J2 allocation agent is unreachable',
          details: isTimeout
            ? `No response from ${J2_BASE_URL} within ${J2_REQUEST_TIMEOUT_MS / 1000} seconds.`
            : error instanceof Error ? error.message : String(error),
          status: 'FAILED',
        },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!j2Response.ok) {
      const message = await j2Response.text();
      return NextResponse.json(
        {
          error: 'J2 allocation agent failed to generate a resource plan',
          details: message,
          status: 'FAILED',
        },
        { status: 502 }
      );
    }

    const j2Payload = await j2Response.json();
    const planData = j2Payload.allocation_plan ? j2Payload : { allocation_plan: j2Payload };
    const savedPlan = await saveResourcePlan({
      incidentId: incidentId ?? null,
      requestedBy: triggeredBy ?? null,
      planData,
      divisionsAnalyzed: j2Payload.divisions_analyzed ?? null,
    });

    return NextResponse.json(
      {
        ...savedPlan,
        plan_data: planData,
        source: 'j2-allocation-agent',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Resource plan generate error:', error);
    return NextResponse.json({ error: 'Failed to generate resource plan' }, { status: 500 });
  }
}
