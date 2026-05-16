import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, passkey } = await request.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    const { rows } = await pool.query(
      `SELECT * FROM public."User" WHERE lower(email) = $1 LIMIT 1`,
      [normalizedEmail]
    );
    const user = rows[0];

    if (!user || !user.password_hash) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(passkey, user.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...safeUser } = user;

    return NextResponse.json(
      {
        success: true,
        user: safeUser,
        token: 'demo-token-' + Date.now(), // TODO: Replace with real JWT generation
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Login route error:', err);

    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
