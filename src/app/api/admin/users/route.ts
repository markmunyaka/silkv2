import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import type {
  AdminUser,
  UpdateUserPayload,
  AdminApiResponse,
  PaginatedResponse,
} from '@/types/admin';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// GET /api/admin/users?page=1&pageSize=20&search=&status=&role=
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
): Promise<NextResponse<AdminApiResponse<PaginatedResponse<AdminUser>>>> {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const search = searchParams.get('search') || '';
    const statusFilter = searchParams.get('status') || '';
    const roleFilter = searchParams.get('role') || '';

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (statusFilter === 'active' || statusFilter === 'suspended' || statusFilter === 'frozen') {
      where.status = statusFilter;
    }

    if (roleFilter === 'admin' || roleFilter === 'standard') {
      where.role = roleFilter;
    }

    const [total, raw] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { files: true } } },
      }),
    ]);

    const items: AdminUser[] = raw.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: (u.role as AdminUser['role']) || 'standard',
      status: (u.status as AdminUser['status']) || 'active',
      credits: u.credits,
      isSubscribed: u.isSubscribed,
      subscriptionPlan: u.subscriptionPlan,
      fileCount: u._count.files,
      violationReason: u.violationReason,
      frozenAt: u.frozenAt ? u.frozenAt.toISOString() : null,
      bannedAt: u.bannedAt ? u.bannedAt.toISOString() : null,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      data: { items, total, page, pageSize },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/admin/users]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/users  —  Update user (role, status, credits, violationReason)
// ---------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
): Promise<NextResponse<AdminApiResponse<AdminUser>>> {
  try {
    const body = await request.json();
    const { userId, ...updates } = body as { userId: string } & UpdateUserPayload;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: userId.' },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'User not found.' },
        { status: 404 },
      );
    }

    const data: Record<string, unknown> = {};
    if (updates.role) data.role = updates.role;
    if (updates.status) data.status = updates.status;
    if (updates.credits !== undefined) data.credits = updates.credits;

    // Handle violation reason
    if (updates.violationReason !== undefined) {
      data.violationReason = updates.violationReason;
    }

    // If suspending or freezing, set the timestamp
    if (updates.status === 'suspended') {
      data.bannedAt = new Date().toISOString();
    } else if (updates.status === 'frozen') {
      data.frozenAt = new Date().toISOString();
    } else if (updates.status === 'active') {
      // Clear violation data when reactivating
      if (existing.violationReason || existing.frozenAt || existing.bannedAt) {
        data.violationReason = null;
        data.frozenAt = null;
        data.bannedAt = null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No valid fields provided to update.' },
        { status: 400 },
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      include: { _count: { select: { files: true } } },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: (updated.role as AdminUser['role']) || 'standard',
        status: (updated.status as AdminUser['status']) || 'active',
        credits: updated.credits,
        isSubscribed: updated.isSubscribed,
        subscriptionPlan: updated.subscriptionPlan,
        fileCount: updated._count.files,
        violationReason: updated.violationReason,
        frozenAt: updated.frozenAt ? updated.frozenAt.toISOString() : null,
        bannedAt: updated.bannedAt ? updated.bannedAt.toISOString() : null,
        lastLoginAt: updated.lastLoginAt ? updated.lastLoginAt.toISOString() : null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[PATCH /api/admin/users]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/users?userId=
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
): Promise<NextResponse<AdminApiResponse<{ deletedUserId: string }>>> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Missing query param: userId.' },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'User not found.' },
        { status: 404 },
      );
    }

    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({
      ok: true,
      data: { deletedUserId: userId },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[DELETE /api/admin/users]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}