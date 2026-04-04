import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../lib/auth';
import { prisma } from '../../../../../../lib/prisma';
import { isProgramAllowed } from '../../../../../../lib/isProgramAllowed';


export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const sessionEntityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const allowed = await isProgramAllowed(uid, sessionEntityId, 'ADMIN_ENTITIES');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const eid = Number(params.id);
    const body = await request.json();
    const moduleId = Number(body.moduleId);
    const linked = Boolean(body.linked);
    if (!eid || !moduleId) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    if (linked) {
      await prisma.entityModule.create({ data: { entityId: eid, moduleId } }).catch(() => null);
    } else {
      const em = await prisma.entityModule.findUnique({
        where: { entityId_moduleId: { entityId: eid, moduleId } },
        select: { id: true },
      });
      if (em?.id) {
        await prisma.$transaction([
          prisma.entityModuleProgram.deleteMany({ where: { entityModuleId: em.id } }),
          prisma.entityModule.delete({ where: { id: em.id } }),
        ]);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// Operações em lote: vincular todos ou desvincular todos os módulos da entidade
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const sessionEntityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const allowed = await isProgramAllowed(uid, sessionEntityId, 'ADMIN_ENTITIES');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const eid = Number(params.id);
    if (!eid) return NextResponse.json({ error: 'ID da entidade inválido' }, { status: 400 });

    const body = await request.json();
    const action = String(body?.action || '').toLowerCase();

    if (action === 'link_all') {
      const modules = await prisma.module.findMany({ where: { isActive: true }, select: { id: true } });
      await prisma.entityModule.createMany({
        data: modules.map((m) => ({ entityId: eid, moduleId: m.id })),
        skipDuplicates: true,
      });
      return NextResponse.json({ ok: true, action: 'link_all' });
    }

    if (action === 'unlink_all') {
      await prisma.$transaction([
        prisma.entityModuleProgram.deleteMany({ where: { entityModule: { entityId: eid } } }),
        prisma.entityModule.deleteMany({ where: { entityId: eid } }),
      ]);
      return NextResponse.json({ ok: true, action: 'unlink_all' });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// Lista todos os módulos ativos e indica se estão vinculados à entidade
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const sessionEntityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const allowed = await isProgramAllowed(uid, sessionEntityId, 'ADMIN_ENTITIES');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const eid = Number(params.id);
    if (!eid) return NextResponse.json({ error: 'ID da entidade inválido' }, { status: 400 });

    const [modules, links] = await Promise.all([
      prisma.module.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
      prisma.entityModule.findMany({ where: { entityId: eid }, select: { moduleId: true } }),
    ]);
    const linkedSet = new Set(links.map((l) => l.moduleId));
    const out = modules.map((m) => ({ ...m, linked: linkedSet.has(m.id) }));

    return NextResponse.json({ modules: out });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
