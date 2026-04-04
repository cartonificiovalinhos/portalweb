import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { isProgramAllowed } from '../../../../../lib/isProgramAllowed';

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const entityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_MODULES');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const id = Number(params.id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const exists = await prisma.module.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 });

    await prisma.$transaction([
      prisma.userEntityModuleProgram.deleteMany({ where: { userEntityModule: { moduleId: id } } }),
      prisma.userEntityModule.deleteMany({ where: { moduleId: id } }),
      prisma.entityModuleProgram.deleteMany({ where: { entityModule: { moduleId: id } } }),
      prisma.entityModule.deleteMany({ where: { moduleId: id } }),
      prisma.program.deleteMany({ where: { moduleId: id } }),
      prisma.module.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const entityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_MODULES');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const id = Number(params.id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const body = await request.json();
    const name = String(body.name || '').trim();
    const description = body.description ? String(body.description).trim() : null;
    const showDashboardTab = Boolean(body.showDashboardTab);
    if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });
    const exists = await prisma.module.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 });
    await prisma.module.update({ where: { id }, data: { name, description, showDashboardTab } });
    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
