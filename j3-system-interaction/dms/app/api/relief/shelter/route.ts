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

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { shelterId, max_capacity, current_occupancy, status } = body;

    // Use COALESCE to update only the fields provided in the request
    const query = `
      UPDATE public."Shelter" 
      SET 
        max_capacity = COALESCE($1, max_capacity), 
        current_occupancy = COALESCE($2, current_occupancy), 
        status = COALESCE($3, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE shelter_id = $4
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      max_capacity ?? null,
      current_occupancy ?? null,
      status ?? null,
      shelterId
    ]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Shelter not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Database Error updating shelter:', error);
    return NextResponse.json({ error: 'Failed to update shelter' }, { status: 500 });
  }
}