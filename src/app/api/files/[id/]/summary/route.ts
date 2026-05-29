import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const GET = async (request: NextRequest) => {
  try {
    const fileId = request.url.pathname.split('/')[2] || '';
    if (!fileId) {
      return NextResponse.json({ error: 'Missing file ID' }, { status: 400 });
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (!file.summary) {
      return NextResponse.json({ error: 'No summary available' }, { status: 400 });
    }

    return NextResponse.json({ summary: file.summary },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json({ error: 'Internal server error' },
      { status: 500 }
    );
  }
};