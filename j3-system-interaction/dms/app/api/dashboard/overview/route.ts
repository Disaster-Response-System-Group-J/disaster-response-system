import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    // Run multiple count queries concurrently
    const [incidents, resources, shelters] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM public."ActiveIncident" WHERE status = $1', ['ACTIVE']),
      pool.query('SELECT COUNT(*) as count FROM public."DeployableAsset" WHERE status = $1', ['AVAILABLE']),
      pool.query('SELECT COUNT(*) as count FROM public."Shelter" WHERE status != $1', ['CLOSED'])
    ]);

    // Format the response for your frontend
    const stats = {
      activeIncidents: parseInt(incidents.rows[0].count, 10),
      availableResources: parseInt(resources.rows[0].count, 10),
      openShelters: parseInt(shelters.rows[0].count, 10),
    };
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Database Error fetching overview stats:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}