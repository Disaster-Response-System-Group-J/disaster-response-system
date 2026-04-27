import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email, passkey } = await request.json();

    // Validate credentials
    if (email === "admin@gmail.com" && passkey === "admin123") {
      return NextResponse.json(
        {
          success: true,
          user: {
            email: "admin@gmail.com",
            role: "administrator",
            name: "Incident Commander",
            id: "IC-001",
          },
          token: "demo-token-" + Date.now(), // In production, use JWT
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Invalid credentials" },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
