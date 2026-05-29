import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/admin/store/rdp - List all RDP products (including inactive)
export async function GET() {
  try {
    const products = await prisma.rdpProduct.findMany({ orderBy: { createdAt: 'desc' } });
    const parsed = products.map((p: any) => ({
      ...p,
      os: JSON.parse(p.os),
      features: JSON.parse(p.features),
    }));
    return NextResponse.json({ ok: true, data: parsed });
  } catch (error) {
    console.error('[GET /api/admin/store/rdp]', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch RDP products' }, { status: 500 });
  }
}

// POST /api/admin/store/rdp - Create a new RDP product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const product = await prisma.rdpProduct.create({
      data: {
        name: body.name,
        specs: body.specs,
        ram: body.ram,
        storage: body.storage,
        cpu: body.cpu,
        bandwidth: body.bandwidth,
        os: JSON.stringify(body.os),
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
    console.error('[POST /api/admin/store/rdp]', error);
    return NextResponse.json({ ok: false, error: 'Failed to create RDP product' }, { status: 500 });
  }
}

// PATCH /api/admin/store/rdp - Update an RDP product
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ ok: false, error: 'Product ID is required' }, { status: 400 });

    const updateData: any = { ...data };
    if (data.os) updateData.os = JSON.stringify(data.os);
    if (data.features) updateData.features = JSON.stringify(data.features);

    const product = await prisma.rdpProduct.update({ where: { id }, data: updateData });
    return NextResponse.json({ ok: true, data: product });
  } catch (error) {
    console.error('[PATCH /api/admin/store/rdp]', error);
    return NextResponse.json({ ok: false, error: 'Failed to update RDP product' }, { status: 500 });
  }
}

// DELETE /api/admin/store/rdp?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'Product ID is required' }, { status: 400 });
    await prisma.rdpProduct.delete({ where: { id } });
    return NextResponse.json({ ok: true, data: { id } });
  } catch (error) {
    console.error('[DELETE /api/admin/store/rdp]', error);
    return NextResponse.json({ ok: false, error: 'Failed to delete RDP product' }, { status: 500 });
  }
}