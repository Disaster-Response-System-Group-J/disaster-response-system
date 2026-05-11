import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { kafkaClient } from '@/lib/kafka-stub';
//import { kafkaClient } from '@/lib/kafka-stub';

export async function GET(): Promise<Response> {
  try {
    const query = 'SELECT * FROM public."PublicAlert" WHERE status = $1 ORDER BY issued_at DESC';
    const { rows } = await pool.query(query, ['ACTIVE']);

    const mappedAlerts = rows.map((row: any) => ({
      alertId: `ALT-${row.alert_id}`,
      title: row.title,
      description: row.message,
      severity: row.severity_level,
      type: 'PUBLIC_ALERT',
      district: 'ALL',
      isPublic: true,
      isActive: row.status === 'ACTIVE',
      createdAt: row.issued_at,
      source: 'SYSTEM'
    }));

    return NextResponse.json(mappedAlerts);
  } catch (error) {
    console.error('Database Error fetching public alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const data = await req.json();
    const query = `
      INSERT INTO public."PublicAlert" (title, message, severity_level, status) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      data.title,
      data.description,
      data.severity,
      data.incidentId || null,
      'ACTIVE'
    ]);

    const newAlert = rows[0];

    // Broadcast the new alert to Kafka for mobile apps
    try {
      await kafkaClient.publish('alerts.public.broadcast', {
        eventId: `alert-${newAlert.alert_id}-${Date.now()}`,
        eventType: 'public-alert-created',
        timestamp: new Date().toISOString(),
        payload: {
          alertId: newAlert.alert_id,
          incidentId: newAlert.incident_id,
          title: newAlert.title,
          message: newAlert.message,
          severity: newAlert.severity_level
        },
      });
    } catch (kafkaError) {
      console.error('Failed to publish alert to Kafka:', kafkaError);
      // We don't fail the API request if Kafka fails, but we log it.
    }

    return NextResponse.json({ success: true, alert: newAlert });
  } catch (err) {
    console.error('Database Error creating alert:', err);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}