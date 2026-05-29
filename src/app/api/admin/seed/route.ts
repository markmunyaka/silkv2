import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import type { AdminApiResponse } from '@/types/admin';

const prisma = new PrismaClient();

interface SeedResult {
  message: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

// ---------------------------------------------------------------------------
// POST /api/admin/seed  —  Create the first admin user in the database
// Body: { email, password, name }
// ---------------------------------------------------------------------------
export async function POST(
  request: Request,
): Promise<NextResponse<AdminApiResponse<SeedResult>>> {
  try {
    const body = await request.json();
    const { email, password, name } = body as { email: string; password: string; name: string };

    if (!email || !password || !name) {
      return NextResponse.json(
        { ok: false, error: 'Email, password, and name are required.' },
        { status: 400 },
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { ok: false, error: 'Password must be at least 4 characters.' },
        { status: 400 },
      );
    }

    // Check if any admin already exists
    const existingAdmin = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (existingAdmin) {
      return NextResponse.json(
        { ok: false, error: 'An admin user already exists. Use the login page.' },
        { status: 409 },
      );
    }

    // Check if email is taken
    const existingEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingEmail) {
      return NextResponse.json(
        { ok: false, error: 'Email already registered.' },
        { status: 409 },
      );
    }

    // Create the admin user
    // In production, hash the password with bcrypt
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password, // Store directly for local dev (hash in production)
        role: 'admin',
        status: 'active',
        credits: 999, // Give admins plenty of credits
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        message: 'Admin user created successfully. You can now log in at the admin page.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[POST /api/admin/seed]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}