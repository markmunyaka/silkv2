import { NextRequest, NextResponse } from 'next/server';
import type { AdminUser, AdminApiResponse, PaginatedResponse } from '@/types/admin';

// ---------------------------------------------------------------------------
// POST /api/admin/local-users
// Accepts localStorage users from the client and returns them as AdminUsers
// This bridges the gap between localStorage-based auth and DB-based admin
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
): Promise<NextResponse<AdminApiResponse<{ imported: number }>>> {
  try {
    const body = await request.json();
    const { users } = body as { users: Array<{ id: string; name: string; email: string; role?: string }> };

    if (!Array.isArray(users)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid users array.' },
        { status: 400 },
      );
    }

    // Store in process memory for the admin API to access
    // @ts-ignore - global storage for localStorage users
    if (!global.__localStorageUsers) {
      // @ts-ignore
      global.__localStorageUsers = [];
    }
    // @ts-ignore
    global.__localStorageUsers = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role || 'standard',
      status: 'active' as const,
      credits: 2,
      isSubscribed: false,
      subscriptionPlan: null,
      fileCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      data: { imported: users.length },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}