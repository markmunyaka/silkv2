import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/mailer/providers - Get all visible SMTP providers for users
export async function GET() {
  try {
    const providers = await prisma.smtpProvider.findMany({
      where: {
        isActive: true,
        isVisibleToUsers: true,
      },
      orderBy: { name: 'asc' },
    });

    // Only expose non-sensitive fields to users
    const data = providers.map((p) => ({
      id: p.id,
      name: p.name,
      provider: p.provider,
      host: p.host,
      port: p.port,
      secure: p.secure,
      fromEmail: p.fromEmail,
      fromName: p.fromName,
      maxEmailsPerDay: p.maxEmailsPerDay,
      maxEmailsPerHour: p.maxEmailsPerHour,
      delayBetweenEmailsMs: p.delayBetweenEmailsMs,
      lastTestedAt: p.lastTestedAt,
      testStatus: p.testStatus,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch SMTP providers' },
      { status: 500 }
    );
  }
}