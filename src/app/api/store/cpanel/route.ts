import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/store/cpanel - List all active cPanel products
export async function GET() {
  try {
    const products = await prisma.cpanelProduct.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    // Parse JSON fields for the frontend
    const parsed = products.map((p: any) => ({
      ...p,
      features: JSON.parse(p.features),
    }));

    return NextResponse.json({ ok: true, data: parsed });
  } catch (error) {
    console.error('[GET /api/store/cpanel]', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch cPanel products' }, { status: 500 });
  }
}