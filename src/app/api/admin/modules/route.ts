import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { isProgramAllowed } from '../../../../lib/isProgramAllowed';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const entityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_MODULES');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const modules = await prisma.module.findMany({
      select: { id: true, code: true, name: true, description: true, isActive: true, showDashboardTab: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ modules });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const entityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_MODULES');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const body = await request.json();
    const code = String(body.code || '').trim();
    const name = String(body.name || '').trim();
    const description = body.description ? String(body.description).trim() : null;
    const showDashboardTab = Boolean(body.showDashboardTab);
    if (!code || !name) return NextResponse.json({ error: 'Código e Nome obrigatórios' }, { status: 400 });
    const exists = await prisma.module.findUnique({ where: { code }, select: { id: true } });
    if (exists) return NextResponse.json({ error: 'Código já cadastrado' }, { status: 409 });
    const created = await prisma.module.create({
      data: { code, name, description, isActive: true, showDashboardTab },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
