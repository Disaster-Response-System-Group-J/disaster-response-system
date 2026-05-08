import { NextResponse } from 'next/server';
import { localDb } from '@/lib/db';

export async function GET(): Promise<Response> {
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

export async function POST(req: Request): Promise<Response> {
  try {
    const data = await req.json();
    await new Promise((resolve, reject) => {
      localDb.run(
        `INSERT INTO local_alerts (title, message, severity_level, status) VALUES (?, ?, ?, ?)`,
        [data.title, data.description, data.severity, 'ACTIVE'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}