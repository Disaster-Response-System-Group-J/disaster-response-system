import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT dp.*, d.division_name, d.district
      FROM disaster_predictions dp
      LEFT JOIN "Division" d ON dp.division_id = d.division_id
      WHERE dp.predicted_for_date >= CURRENT_DATE
      ORDER BY dp.predicted_for_date ASC, dp.predicted_severity DESC NULLS LAST
    `;
    const { rows } = await pool.query(query);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Predictions fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 });
  }
}