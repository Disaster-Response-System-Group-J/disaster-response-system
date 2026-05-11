import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service key to query users safely
);

export async function POST(request: NextRequest) {
  try {
    const { email, passkey } = await request.json();

    const { data: user, error } = await supabase
      .from('User')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user || !user.password_hash) {
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
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}