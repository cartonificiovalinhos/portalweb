import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../../../lib/auth';
import { prisma } from '../../../../../../../../lib/prisma';
import { isProgramAllowed } from '../../../../../../../../lib/isProgramAllowed';

export async function GET(_: Request, props: { params: Promise<{ id: string; moduleId: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const entityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_ENTITIES');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const eid = Number(params.id);
    const mid = Number(params.moduleId);
    if (!eid || !mid) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    const em = await prisma.entityModule.findUnique({
      where: { entityId_moduleId: { entityId: eid, moduleId: mid } },
      select: { id: true },
    });
    const [programs, perms] = await Promise.all([
      prisma.program.findMany({ where: { moduleId: mid }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
      em?.id
        ? prisma.entityModuleProgram.findMany({ where: { entityModuleId: em.id }, select: { programId: true, allowed: true } })
        : Promise.resolve([] as Array<{ programId: number; allowed: boolean }>),
    ]);
    const allowedByProgramId = new Map(perms.map((p) => [p.programId, p.allowed]));
    const out = programs.map((p) => ({ ...p, allowed: allowedByProgramId.get(p.id) ? 1 : 0 }));
    return NextResponse.json({ programs: out });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string; moduleId: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const entityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_ENTITIES');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const eid = Number(params.id);
    const mid = Number(params.moduleId);
    const body = await request.json();
    const programId = Number(body.programId);
    const enabled = Boolean(body.allowed);
    if (!eid || !mid || !programId) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    const em = await prisma.entityModule.findUnique({
      where: { entityId_moduleId: { entityId: eid, moduleId: mid } },
      select: { id: true },
    });
    if (!em?.id) return NextResponse.json({ error: 'Módulo não vinculado à entidade' }, { status: 400 });
    const existing = await prisma.entityModuleProgram.findUnique({
      where: { entityModuleId_programId: { entityModuleId: em.id, programId } },
      select: { id: true },
    });
    if (!existing) {
      if (enabled) {
        await prisma.entityModuleProgram.create({ data: { entityModuleId: em.id, programId, allowed: true } });
      }
    } else {
      await prisma.entityModuleProgram.update({
        where: { entityModuleId_programId: { entityModuleId: em.id, programId } },
        data: { allowed: enabled },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// Operações em lote nos programas do módulo selecionado
export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string; moduleId: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const entityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_ENTITIES');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const eid = Number(params.id);
    const mid = Number(params.moduleId);
    if (!eid || !mid) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });

    const body = await request.json();
    const action = String(body?.action || '').toLowerCase();

    const em = await prisma.entityModule.findUnique({
      where: { entityId_moduleId: { entityId: eid, moduleId: mid } },
      select: { id: true },
    });
    if (!em?.id) return NextResponse.json({ error: 'Módulo não vinculado à entidade' }, { status: 400 });
    const emId = em.id;

    if (action === 'allow_all') {
      const programs = await prisma.program.findMany({ where: { moduleId: mid }, select: { id: true } });
      await prisma.entityModuleProgram.createMany({
        data: programs.map((p) => ({ entityModuleId: emId, programId: p.id, allowed: true })),
        skipDuplicates: true,
      });
      await prisma.entityModuleProgram.updateMany({ where: { entityModuleId: emId }, data: { allowed: true } });
      return NextResponse.json({ ok: true, action: 'allow_all' });
    }

    if (action === 'deny_all') {
      await prisma.entityModuleProgram.updateMany({ where: { entityModuleId: emId }, data: { allowed: false } });
      return NextResponse.json({ ok: true, action: 'deny_all' });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
