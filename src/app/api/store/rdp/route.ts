import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/store/rdp - List all active RDP products
export async function GET() {
  try {
    const products = await prisma.rdpProduct.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    // Parse JSON fields for the frontend
    const parsed = products.map((p) => ({
      ...p,
      os: JSON.parse(p.os),
      features: JSON.parse(p.features),
    }));

    return NextResponse.json({ ok: true, data: parsed });
  } catch (error) {
    console.error('[GET /api/store/rdp]', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch RDP products' }, { status: 500 });
  }
}