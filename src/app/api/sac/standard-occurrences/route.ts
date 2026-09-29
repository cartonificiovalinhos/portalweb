import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { toMySqlContainsPattern } from '@/lib/mysql-like';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    const items = q
      ? await prisma.$queryRawUnsafe<any[]>(
          `SELECT id, description
             FROM standardoccurrence
            WHERE description COLLATE utf8mb4_unicode_ci LIKE ? ESCAPE '\\'
            ORDER BY description ASC`,
          toMySqlContainsPattern(q),
        )
      : await prisma.standardOccurrence.findMany({
          orderBy: { description: 'asc' },
          select: { id: true, description: true },
        });
    return NextResponse.json(items);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const description = String(body.description || '').trim();
    if (!description) return NextResponse.json({ error: 'Descrição é obrigatória' }, { status: 400 });
    const created = await prisma.standardOccurrence.create({
      data: { description },
      select: { id: true, description: true },
    });
    return NextResponse.json(created);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
