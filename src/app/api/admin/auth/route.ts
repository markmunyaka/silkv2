import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import type { AdminApiResponse } from '@/types/admin';

const prisma = new PrismaClient();

interface AdminAuthPayload {
  username: string;
  password: string;
}

interface AdminAuthResult {
  id: string;
  name: string;
  email: string;
  role: string;
  token: string;
}

// ---------------------------------------------------------------------------
// POST /api/admin/auth  —  Verify admin credentials against the database
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
): Promise<NextResponse<AdminApiResponse<AdminAuthResult>>> {
  try {
    const body = await request.json();
    const { username, password } = body as AdminAuthPayload;

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: 'Username and password are required.' },
        { status: 400 },
      );
    }

    // Try to find the user by email (username is treated as email)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: username.toLowerCase().trim() },
          { name: username.trim() },
        ],
      },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Invalid credentials.' },
        { status: 401 },
      );
    }

    // Check if user has admin role
    if (user.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Access denied. Admin privileges required.' },
        { status: 403 },
      );
    }

    // Check if account is active
    if (user.status !== 'active') {
      return NextResponse.json(
        { ok: false, error: 'Account is suspended. Contact support.' },
        { status: 403 },
      );
    }

    // In production, use bcrypt.compare. For local dev, direct comparison
    // The password field may be null for OAuth users
    if (!user.password) {
      return NextResponse.json(
        { ok: false, error: 'Account has no password set. Use the main login.' },
        { status: 401 },
      );
    }

    if (user.password !== password) {
      return NextResponse.json(
        { ok: false, error: 'Invalid credentials.' },
        { status: 401 },
      );
    }

    // Generate a simple session token (in production, use JWT)
    const token = Buffer.from(
      JSON.stringify({ id: user.id, role: user.role, exp: Date.now() + 3600000 })
    ).toString('base64');

    return NextResponse.json({
      ok: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[POST /api/admin/auth]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/auth/check  —  Verify a session token
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
): Promise<NextResponse<AdminApiResponse<{ valid: boolean; role?: string }>>> {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'No token provided.' },
        { status: 401 },
      );
    }

    // Decode and verify the simple token
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      if (decoded.exp < Date.now()) {
        return NextResponse.json(
          { ok: false, error: 'Token expired.' },
          { status: 401 },
        );
      }

      // Verify the user still exists and is admin
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user || user.role !== 'admin' || user.status !== 'active') {
        return NextResponse.json(
          { ok: false, error: 'Access revoked.' },
          { status: 403 },
        );
      }

      return NextResponse.json({
        ok: true,
        data: { valid: true, role: user.role },
      });
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid token.' },
        { status: 401 },
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}