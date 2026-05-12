import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(): Promise<Response> {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, role, "assignedDistrict", "createdAt" FROM public."User" ORDER BY "createdAt" DESC`
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
