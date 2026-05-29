import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/store/orders?userId=xxx&type=rdp
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const type = request.nextUrl.searchParams.get('type'); // optional filter

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'userId is required' }, { status: 400 });
    }

    const where: any = { userId };
    if (type) where.productType = type;

    const orders = await prisma.storeOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ok: true, data: orders });
  } catch (error) {
    console.error('[GET /api/store/orders]', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// POST /api/store/orders
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, productType, productId, productName, productSpecs, price, duration, config } = body;

    if (!userId || !productType || !productId || !productName) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    const order = await prisma.storeOrder.create({
      data: {
        userId,
        productType,
        productId,
        productName,
        productSpecs: productSpecs || null,
        price: price || 0,
        duration: duration || null,
        config: config ? JSON.stringify(config) : null,
        status: 'pending',
      },
    });

    return NextResponse.json({ ok: true, data: order });
  } catch (error) {
    console.error('[POST /api/store/orders]', error);
    return NextResponse.json({ ok: false, error: 'Failed to create order' }, { status: 500 });
  }
}