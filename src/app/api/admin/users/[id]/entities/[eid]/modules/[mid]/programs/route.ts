import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../../../../../lib/prisma';

function normalizeDoc(doc: string): string { return (doc || '').replace(/\D+/g, ''); }
function normalizeCnpj(cnpj: string): string { return (cnpj || '').replace(/\D+/g, ''); }

async function resolveEntityIdByCnpj(entityCnpj: string): Promise<number> {
  if (!entityCnpj) return 0;
  const direct = await prisma.entity
    .findUnique({ where: { cnpj: entityCnpj }, select: { id: true } })
    .catch(() => null);
  if (direct?.id) return direct.id;
  const candidates = await prisma.entity.findMany({ select: { id: true, cnpj: true } });
  const match = candidates.find((e) => normalizeCnpj(String((e as any).cnpj || '')) === entityCnpj);
  return match?.id || 0;
}

// GET: Lista programas vinculados à entidade/módulo e flag se estão permitidos ao usuário
export async function GET(request: Request, { params }: { params: { id: string; eid: string; mid: string } }) {
  try {
    const url = new URL(request.url);
    const userDoc = normalizeDoc(String(url.searchParams.get('userDoc') || ''));
    const entityCnpj = normalizeCnpj(String(url.searchParams.get('entityCnpj') || ''));
    let userId = Number(params.id);
    let entityId = Number(params.eid);
    const moduleId = Number(params.mid);
    if (!userId && userDoc) {
      const u = await prisma.user.findUnique({ where: { doc: userDoc }, select: { id: true } });
      userId = Number(u?.id || 0);
    }
    if (!entityId && entityCnpj) {
      entityId = await resolveEntityIdByCnpj(entityCnpj);
    }
    if (!userId || !entityId || !moduleId) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });

    const [entityModule, userEntity] = await Promise.all([
      prisma.entityModule.findUnique({
        where: { entityId_moduleId: { entityId, moduleId } },
        select: { id: true },
      }),
      prisma.userEntity.findUnique({
        where: { userId_entityId: { userId, entityId } },
        select: { id: true },
      }),
    ]);

    if (!entityModule?.id) return NextResponse.json({ programs: [] });

    const uem = userEntity?.id
      ? await prisma.userEntityModule.findUnique({
          where: { userEntityId_moduleId: { userEntityId: userEntity.id, moduleId } },
          select: { id: true },
        })
      : null;

    const emps = await prisma.entityModuleProgram.findMany({
      where: { entityModuleId: entityModule.id },
      include: { program: { select: { id: true, code: true, name: true } } },
      orderBy: { programId: 'asc' },
    });

    const programIds = emps.map((p) => p.programId);
    const userLinks = uem?.id
      ? await prisma.userEntityModuleProgram.findMany({
          where: { userEntityModuleId: uem.id, programId: { in: programIds } },
          select: { programId: true },
        })
      : [];
    const userAllowedSet = new Set(userLinks.map((l) => l.programId));

    return NextResponse.json({
      programs: emps.map((emp) => ({
        id: emp.program.id,
        code: emp.program.code,
        name: emp.program.name,
        allowed: userAllowedSet.has(emp.program.id) ? 1 : 0,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// PUT: Vincula/Desvincula/Permite programa ao usuário para entidade/módulo
export async function PUT(request: Request, { params }: { params: { id: string; eid: string; mid: string } }) {
  try {
    let userId = Number(params.id);
    let entityId = Number(params.eid);
    const moduleId = Number(params.mid);
    const body = await request.json();
    const userDoc = body?.userDoc ? normalizeDoc(String(body.userDoc)) : '';
    const entityCnpj = body?.entityCnpj ? normalizeCnpj(String(body.entityCnpj)) : '';
    if (!userId && userDoc) {
      const u = await prisma.user.findUnique({ where: { doc: userDoc }, select: { id: true } });
      userId = Number(u?.id || 0);
    }
    if (!entityId && entityCnpj) {
      entityId = await resolveEntityIdByCnpj(entityCnpj);
    }
    if (!userId || !entityId || !moduleId) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    const programId = Number(body?.programId);
    const allowed = Boolean(body?.allowed);
    if (!programId) return NextResponse.json({ error: 'programId inválido' }, { status: 400 });

    if (allowed) {
      const ue = await prisma.userEntity.upsert({
        where: { userId_entityId: { userId, entityId } },
        create: { userId, entityId },
        update: {},
        select: { id: true },
      });
      await prisma.$transaction(async (tx) => {
        await tx.userEntityModule.createMany({
          data: [{ userEntityId: ue.id, moduleId, allowed: true }],
          skipDuplicates: true,
        });
        await tx.userEntityModule.updateMany({
          where: { userEntityId: ue.id, moduleId },
          data: { allowed: true },
        });
      });
      const uem = await prisma.userEntityModule.findUnique({
        where: { userEntityId_moduleId: { userEntityId: ue.id, moduleId } },
        select: { id: true },
      });
      if (!uem?.id) return NextResponse.json({ error: 'Falha ao vincular módulo ao usuário' }, { status: 500 });
      await prisma.$transaction(async (tx) => {
        await tx.userEntityModuleProgram.createMany({
          data: [{ userEntityModuleId: uem.id, programId, allowed: true }],
          skipDuplicates: true,
        });
        await tx.userEntityModuleProgram.updateMany({
          where: { userEntityModuleId: uem.id, programId },
          data: { allowed: true },
        });
      });
    } else {
      const ue = await prisma.userEntity.findUnique({
        where: { userId_entityId: { userId, entityId } },
        select: { id: true },
      });
      if (!ue?.id) return NextResponse.json({ ok: true });
      const uem = await prisma.userEntityModule.findUnique({
        where: { userEntityId_moduleId: { userEntityId: ue.id, moduleId } },
        select: { id: true },
      });
      if (!uem?.id) return NextResponse.json({ ok: true });
      await prisma.userEntityModuleProgram.deleteMany({ where: { userEntityModuleId: uem.id, programId } });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// PATCH: Operações em lote para programas do usuário dentro da entidade/módulo
export async function PATCH(request: Request, { params }: { params: { id: string; eid: string; mid: string } }) {
  try {
    let userId = Number(params.id);
    let entityId = Number(params.eid);
    const moduleId = Number(params.mid);
    const body = await request.json().catch(() => ({} as any));
    const userDoc = body?.userDoc ? normalizeDoc(String(body.userDoc)) : '';
    const entityCnpj = body?.entityCnpj ? normalizeCnpj(String(body.entityCnpj)) : '';
    if (!userId && userDoc) {
      const u = await prisma.user.findUnique({ where: { doc: userDoc }, select: { id: true } });
      userId = Number(u?.id || 0);
    }
    if (!entityId && entityCnpj) {
      entityId = await resolveEntityIdByCnpj(entityCnpj);
    }
    if (!userId || !entityId || !moduleId) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    const action = String(body?.action || '').toLowerCase();

    const ue = action === 'link_all'
      ? await prisma.userEntity.upsert({
          where: { userId_entityId: { userId, entityId } },
          create: { userId, entityId },
          update: {},
          select: { id: true },
        })
      : await prisma.userEntity.findUnique({
          where: { userId_entityId: { userId, entityId } },
          select: { id: true },
        });
    if (!ue?.id) return NextResponse.json({ ok: true, action });

    if (action === 'link_all') {
      await prisma.$transaction(async (tx) => {
        await tx.userEntityModule.createMany({
          data: [{ userEntityId: ue.id, moduleId, allowed: true }],
          skipDuplicates: true,
        });
        await tx.userEntityModule.updateMany({
          where: { userEntityId: ue.id, moduleId },
          data: { allowed: true },
        });
      });
    }
    const uem = await prisma.userEntityModule.findUnique({
      where: { userEntityId_moduleId: { userEntityId: ue.id, moduleId } },
      select: { id: true },
    });
    if (!uem?.id) return NextResponse.json({ ok: true, action });

    if (action === 'link_all') {
      const em = await prisma.entityModule.findUnique({
        where: { entityId_moduleId: { entityId, moduleId } },
        select: { id: true },
      });
      if (!em?.id) return NextResponse.json({ ok: true, action: 'link_all' });
      const empPrograms = await prisma.entityModuleProgram.findMany({
        where: { entityModuleId: em.id },
        select: { programId: true },
      });
      await prisma.userEntityModuleProgram.createMany({
        data: empPrograms.map((p) => ({ userEntityModuleId: uem.id, programId: p.programId, allowed: true })),
        skipDuplicates: true,
      });
      return NextResponse.json({ ok: true, action: 'link_all' });
    }

    if (action === 'unlink_all') {
      // Remove todos os programas vinculados ao usuário para este módulo
      await prisma.userEntityModuleProgram.deleteMany({ where: { userEntityModuleId: uem.id } });
      return NextResponse.json({ ok: true, action: 'unlink_all' });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
