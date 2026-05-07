import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    // Fetch all shelters from Supabase
    const query = 'SELECT * FROM public."Shelter" ORDER BY name ASC';
    const { rows } = await pool.query(query);
    
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Database Error fetching shelters:', error);
    return NextResponse.json({ error: 'Failed to fetch shelters' }, { status: 500 });
  }
}