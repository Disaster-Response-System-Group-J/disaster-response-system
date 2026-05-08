import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT r.*, d.division_name 
      FROM public."DisasterRisk" r
      LEFT JOIN public."Division" d ON r.division_id = d.division_id
      ORDER BY r.date DESC
    `;
    const { rows } = await pool.query(query);
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 });
  }
}