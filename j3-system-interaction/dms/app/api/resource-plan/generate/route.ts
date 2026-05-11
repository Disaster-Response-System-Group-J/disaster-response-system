import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { kafkaClient } from '@/lib/kafka-stub';

export async function POST(request: Request) {
  try {
    const { incidentId, triggeredBy } = await request.json();

    // 1. Save PENDING plan record to DB
    const { rows } = await pool.query(
      `INSERT INTO resource_plans (incident_id, triggered_by, status)
       VALUES ($1, $2, 'PENDING')
       RETURNING plan_id, triggered_at`,
      [incidentId ?? null, triggeredBy ?? null]
    );
    const plan = rows[0];

    // 2. Publish request to Kafka — J2 will respond on j2.engine.resource-plans
    await kafkaClient.publish(kafkaClient.PRODUCE_TOPICS.RESOURCE_PLAN_REQUEST, {
      eventId: `rp-${plan.plan_id}-${Date.now()}`,
      eventType: 'resource-plan-request',
      timestamp: new Date().toISOString(),
      payload: { planId: plan.plan_id, incidentId: incidentId ?? null },
    });

    return NextResponse.json({ planId: plan.plan_id, status: 'PENDING', triggeredAt: plan.triggered_at });
  } catch (error) {
    console.error('Resource plan generate error:', error);
    return NextResponse.json({ error: 'Failed to trigger resource plan' }, { status: 500 });
  }
}
