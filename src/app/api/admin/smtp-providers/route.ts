import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/admin/smtp-providers - List all SMTP providers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeSensitive = searchParams.get('includeSensitive') === 'true';

    const providers = await prisma.smtpProvider.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Mask sensitive data unless explicitly requested
    const data = providers.map((p) => {
      if (!includeSensitive) {
        return {
          ...p,
          password: '••••••••',
        };
      }
      return p;
    });

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch SMTP providers' },
      { status: 500 }
    );
  }
}

// POST /api/admin/smtp-providers - Create a new SMTP provider
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      provider,
      host,
      port,
      secure,
      username,
      password,
      fromEmail,
      fromName,
      maxEmailsPerDay,
      maxEmailsPerHour,
      delayBetweenEmailsMs,
      bomberSubject,
      bomberHtml,
      bomberSmtpHost,
      bomberSmtpPort,
      bomberSmtpSecure,
      bomberSmtpUsername,
      bomberSmtpPassword,
      isActive,
      isVisibleToUsers,
    } = body;

    if (!name || !host || !username || !password || !fromEmail) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: name, host, username, password, fromEmail' },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await prisma.smtpProvider.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'A provider with this name already exists' },
        { status: 409 }
      );
    }

    const created = await prisma.smtpProvider.create({
      data: {
        name,
        provider: provider || 'custom',
        host,
        port: port || 587,
        secure: secure ?? false,
        username,
        password,
        fromEmail,
        fromName: fromName || null,
        maxEmailsPerDay: maxEmailsPerDay || 300,
        maxEmailsPerHour: maxEmailsPerHour || 50,
        delayBetweenEmailsMs: delayBetweenEmailsMs || 200,
        bomberSubject: bomberSubject || null,
        bomberHtml: bomberHtml || null,
        bomberSmtpHost: bomberSmtpHost || null,
        bomberSmtpPort: bomberSmtpPort ? parseInt(bomberSmtpPort) : null,
        bomberSmtpSecure: bomberSmtpSecure ?? null,
        bomberSmtpUsername: bomberSmtpUsername || null,
        bomberSmtpPassword: bomberSmtpPassword || null,
        isActive: isActive ?? true,
        isVisibleToUsers: isVisibleToUsers ?? true,
      },
    });

    return NextResponse.json(
      { ok: true, data: { ...created, password: '••••••••' } },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create SMTP provider' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/smtp-providers - Update an SMTP provider
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Provider ID is required' },
        { status: 400 }
      );
    }

    // If updating name, check for duplicates
    if (updates.name) {
      const existing = await prisma.smtpProvider.findUnique({ where: { name: updates.name } });
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { ok: false, error: 'A provider with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Only include fields that are actually provided
    const updateData: Record<string, any> = {};
    const allowedFields = [
      'name', 'provider', 'host', 'port', 'secure', 'username', 'password',
      'fromEmail', 'fromName', 'maxEmailsPerDay', 'maxEmailsPerHour',
      'delayBetweenEmailsMs', 'isActive', 'isVisibleToUsers',
      'bomberSubject', 'bomberHtml',
      'bomberSmtpHost', 'bomberSmtpPort', 'bomberSmtpSecure',
      'bomberSmtpUsername', 'bomberSmtpPassword',
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    const updated = await prisma.smtpProvider.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ok: true, data: { ...updated, password: '••••••••' } });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to update SMTP provider' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/smtp-providers?id=xxx - Delete an SMTP provider
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Provider ID is required' },
        { status: 400 }
      );
    }

    await prisma.smtpProvider.delete({ where: { id } });

    return NextResponse.json({ ok: true, data: { id, deleted: true } });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to delete SMTP provider' },
      { status: 500 }
    );
  }
}