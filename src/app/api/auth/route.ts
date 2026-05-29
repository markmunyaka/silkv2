import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface AuthResponse {
  ok: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role?: string;
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// POST /api/auth/login  —  Authenticate user against database
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
): Promise<NextResponse<AuthResponse>> {
  try {
    const body = await request.json();
    const { email, password } = body as { email: string; password: string };

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: 'Email and password are required.' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Invalid email or password.' },
        { status: 401 },
      );
    }

    // In production, use bcrypt.compare
    if (user.password !== password) {
      return NextResponse.json(
        { ok: false, error: 'Invalid email or password.' },
        { status: 401 },
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'standard',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[POST /api/auth]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/auth  —  Sign up (register) a new user in the database
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
): Promise<NextResponse<AuthResponse>> {
  try {
    const body = await request.json();
    const { email, password, name } = body as { email: string; password: string; name: string };

    if (!email || !password || !name) {
      return NextResponse.json(
        { ok: false, error: 'All fields are required.' },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'Password must be at least 6 characters.' },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'Email already registered.' },
        { status: 409 },
      );
    }

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password, // In production, hash this with bcrypt
        role: 'standard',
        status: 'active',
        credits: 2,
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'standard',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[PUT /api/auth]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}