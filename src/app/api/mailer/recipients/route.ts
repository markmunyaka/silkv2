import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function parseCSV(csvText: string): Array<{ email: string; firstName?: string; lastName?: string }> {
  const lines = csvText.trim().split('\n');
  const result: Array<{ email: string; firstName?: string; lastName?: string }> = [];

  lines.forEach((line, index) => {
    if (index === 0 && (line.includes('email') || line.includes('Email'))) {
      return;
    }

    const columns = line.split(',').map(col => col.trim());
    if (columns.length > 0 && validateEmail(columns[0])) {
      result.push({
        email: columns[0],
        firstName: columns[1] || undefined,
        lastName: columns[2] || undefined,
      });
    }
  });

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, csvData } = body;

    if (!name || !csvData) {
      return NextResponse.json({ error: 'Missing required fields: name, csvData' }, { status: 400 });
    }

    const recipients = parseCSV(csvData);

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No valid emails found in CSV' }, { status: 400 });
    }

    const recipientList = await prisma.emailRecipientList.create({
      data: {
        userId: user.id,
        name,
        description,
        totalCount: recipients.length,
        recipients: {
          createMany: {
            data: recipients,
          },
        },
      },
      include: {
        recipients: true,
      },
    });

    return NextResponse.json(recipientList, { status: 201 });
  } catch (error) {
    console.error('Error importing recipients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const recipientLists = await prisma.emailRecipientList.findMany({
      where: { userId: user.id },
      include: { _count: { select: { recipients: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(recipientLists);
  } catch (error) {
    console.error('Error fetching recipient lists:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
