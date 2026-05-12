import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function PATCH(request: Request, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const { name, role } = await request.json();
    const { rows } = await pool.query(
      `UPDATE public."User" SET name = $1, role = $2 WHERE id = $3 RETURNING id, email, name, role`,
      [name, role, params.id]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
