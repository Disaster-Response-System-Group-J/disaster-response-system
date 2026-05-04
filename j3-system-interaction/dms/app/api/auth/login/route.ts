import { NextRequest, NextResponse } from 'next/server';
import { MOCK_USERS } from '@/data/mock-data';

export async function POST(request: NextRequest) {
  try {
    const { email, passkey } = await request.json();

    const user = MOCK_USERS.find(
      (u) => u.email === email && u.password === passkey,
    );

    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...safeUser } = user;
      return NextResponse.json(
        {
          success: true,
          user: safeUser,
          token: 'demo-token-' + Date.now(), // TODO: Replace with Keycloak JWT
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { success: false, message: 'Invalid credentials' },
      { status: 401 },
    );
  } catch {
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 },
    );
  }
}
