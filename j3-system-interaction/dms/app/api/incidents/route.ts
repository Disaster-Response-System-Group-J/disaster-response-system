import { NextResponse } from 'next/server';
import { pool } from '@/lib/db'; // Import the Supabase pool we just created

export async function GET() {
  try {
    // Fetch all active incidents from Supabase
    const query = 'SELECT * FROM public."ActiveIncident" ORDER BY created_at DESC';
    const { rows } = await pool.query(query);
    
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 });
  }
}