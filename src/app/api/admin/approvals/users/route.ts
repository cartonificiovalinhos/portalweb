import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { isProgramAllowed } from '../../../../../lib/isProgramAllowed';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const entityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_APPROVAL');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return NextResponse.json({ users: [] });

    const rows = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { abbrevName: { contains: q } },
          { email: { contains: q } },
          { doc: { contains: q.replace(/\D+/g, '') } },
        ],
      },
      orderBy: { name: 'asc' },
      take: 50,
      select: { id: true, name: true, abbrevName: true, email: true, doc: true },
    });

    return NextResponse.json({ users: rows });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

