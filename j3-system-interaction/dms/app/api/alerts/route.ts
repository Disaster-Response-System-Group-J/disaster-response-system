import { NextResponse } from 'next/server';
import { localDb } from '@/lib/db';

export async function GET() {
  return new Promise<Response>((resolve) => {
    localDb.all("SELECT * FROM local_alerts WHERE status = 'ACTIVE' ORDER BY created_at DESC", [], (err, rows) => {
      if (err) {
        console.error('Database Error fetching local alerts:', err);
        resolve(NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 }));
      } else {
        resolve(NextResponse.json(rows || []));
      }
    });
  });
}