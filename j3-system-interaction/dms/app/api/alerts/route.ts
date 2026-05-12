import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { kafkaClient } from '@/lib/kafka-stub';

export async function GET(): Promise<Response> {
  try {
    const query = `
      SELECT * FROM public."Alert"
      WHERE "isActive" = true
      ORDER BY "createdAt" DESC
    `;
    const { rows } = await pool.query(query);

    const mappedAlerts = rows.map((row: any) => ({
      alertId: row.id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      type: row.type,
      district: row.district,
      isPublic: row.isPublic,
      isActive: row.isActive,
      createdAt: row.createdAt,
      source: row.source,
    }));

    return NextResponse.json(mappedAlerts);
  } catch (error) {
    console.error('Database Error fetching alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const data = await req.json();
    const query = `
      INSERT INTO public."Alert" (type, severity, title, description, district, "isPublic", "isActive", source)
      VALUES ($1, $2, $3, $4, $5, $6, true, $7)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      data.type || 'PUBLIC_ALERT',
      data.severity || 'HIGH',
      data.title,
      data.description,
      data.district || 'ALL',
      data.isPublic ?? true,
      data.source || null,
    ]);

    const newAlert = rows[0];

    // Broadcast the new alert to Kafka for mobile apps
    try {
      await kafkaClient.publish('alerts.public.broadcast', {
        eventId: `alert-${newAlert.id}-${Date.now()}`,
        eventType: 'public-alert-created',
        timestamp: new Date().toISOString(),
        payload: {
          alertId: newAlert.id,
          incidentId: newAlert.incidentId,
          title: newAlert.title,
          description: newAlert.description,
          severity: newAlert.severity,
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