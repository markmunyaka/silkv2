import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/admin/store/cpanel - List all cPanel products (including inactive)
export async function GET() {
  try {
    const products = await prisma.cpanelProduct.findMany({ orderBy: { createdAt: 'desc' } });
    const parsed = products.map((p: any) => ({
      ...p,
      features: JSON.parse(p.features),
    }));
    return NextResponse.json({ ok: true, data: parsed });
  } catch (error) {
    console.error('[GET /api/admin/store/cpanel]', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch cPanel products' }, { status: 500 });
  }
}

// POST /api/admin/store/cpanel - Create a new cPanel product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const product = await prisma.cpanelProduct.create({
      data: {
        name: body.name,
        specs: body.specs,
        diskSpace: body.diskSpace,
        bandwidth: body.bandwidth,
        websites: body.websites,
        emailAccounts: body.emailAccounts,
        databases: body.databases,
        ssl: body.ssl ?? true,
        location: body.location,
        price: body.price,
        priceUnit: body.priceUnit || 'month',
        stock: body.stock,
        isActive: body.isActive ?? true,
        features: JSON.stringify(body.features),
      },
    });
    return NextResponse.json({ ok: true, data: product });
  } catch (error) {
    console.error('[POST /api/admin/store/cpanel]', error);
    return NextResponse.json({ ok: false, error: 'Failed to create cPanel product' }, { status: 500 });
  }
}

// PATCH /api/admin/store/cpanel - Update a cPanel product
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ ok: false, error: 'Product ID is required' }, { status: 400 });

    const updateData: any = { ...data };
    if (data.features) updateData.features = JSON.stringify(data.features);

    const product = await prisma.cpanelProduct.update({ where: { id }, data: updateData });
    return NextResponse.json({ ok: true, data: product });
  } catch (error) {
    console.error('[PATCH /api/admin/store/cpanel]', error);
    return NextResponse.json({ ok: false, error: 'Failed to update cPanel product' }, { status: 500 });
  }
}

// DELETE /api/admin/store/cpanel?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'Product ID is required' }, { status: 400 });
    await prisma.cpanelProduct.delete({ where: { id } });
    return NextResponse.json({ ok: true, data: { id } });
  } catch (error) {
    console.error('[DELETE /api/admin/store/cpanel]', error);
    return NextResponse.json({ ok: false, error: 'Failed to delete cPanel product' }, { status: 500 });
  }
}