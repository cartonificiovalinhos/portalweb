import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../../../lib/prisma';

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

// GET: Lista módulos vinculados à entidade (apenas os vinculados) e flag se estão vinculados ao usuário
export async function GET(request: Request, { params }: { params: { id: string; eid: string } }) {
  try {
    const url = new URL(request.url);
    const userDoc = normalizeDoc(String(url.searchParams.get('userDoc') || ''));
    const entityCnpj = normalizeCnpj(String(url.searchParams.get('entityCnpj') || ''));
    let userId = Number(params.id);
    let entityId = Number(params.eid);
    if (!userId && userDoc) {
      const u = await prisma.user.findUnique({ where: { doc: userDoc }, select: { id: true } });
      userId = Number(u?.id || 0);
    }
    if (!entityId && entityCnpj) {
      entityId = await resolveEntityIdByCnpj(entityCnpj);
    }
    if (!userId || !entityId) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });

    const userEntity = await prisma.userEntity.findUnique({
      where: { userId_entityId: { userId, entityId } },
      select: { id: true },
    });

    const entityModules = await prisma.entityModule.findMany({
      where: { entityId },
      include: { module: { select: { id: true, code: true, name: true } } },
      orderBy: { moduleId: 'asc' },
    });

    const userLinkedSet = userEntity?.id
      ? new Set(
          (
            await prisma.userEntityModule.findMany({
              where: { userEntityId: userEntity.id },
              select: { moduleId: true },
            })
          ).map((m) => m.moduleId),
        )
      : new Set<number>();

    return NextResponse.json({
      modules: entityModules.map((em) => ({
        id: em.module.id,
        code: em.module.code,
        name: em.module.name,
        userLinked: userLinkedSet.has(em.module.id) ? 1 : 0,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// PUT: Vincula/Desvincula módulo ao usuário dentro da entidade
export async function PUT(request: Request, { params }: { params: { id: string; eid: string } }) {
  try {
    let userId = Number(params.id);
    let entityId = Number(params.eid);
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
    if (!userId || !entityId) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    const moduleId = Number(body?.moduleId);
    const linked = Boolean(body?.linked);
    if (!moduleId) return NextResponse.json({ error: 'moduleId inválido' }, { status: 400 });

    if (linked) {
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
    } else {
      const ue = await prisma.userEntity.findUnique({
        where: { userId_entityId: { userId, entityId } },
        select: { id: true },
      });
      if (!ue?.id) return NextResponse.json({ ok: true });
      await prisma.$transaction([
        prisma.userEntityModuleProgram.deleteMany({
          where: { userEntityModule: { userEntityId: ue.id, moduleId } },
        }),
        prisma.userEntityModule.deleteMany({ where: { userEntityId: ue.id, moduleId } }),
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// PATCH: Operações em lote para módulos do usuário dentro da entidade
export async function PATCH(request: Request, { params }: { params: { id: string; eid: string } }) {
  try {
    let userId = Number(params.id);
    let entityId = Number(params.eid);
    const body = await request.json().catch(() => ({} as any));
    const action = String(body?.action || '').toLowerCase();
    const userDoc = body?.userDoc ? normalizeDoc(String(body.userDoc)) : '';
    const entityCnpj = body?.entityCnpj ? normalizeCnpj(String(body.entityCnpj)) : '';
    if (!userId && userDoc) {
      const u = await prisma.user.findUnique({ where: { doc: userDoc }, select: { id: true } });
      userId = Number(u?.id || 0);
    }
    if (!entityId && entityCnpj) {
      entityId = await resolveEntityIdByCnpj(entityCnpj);
    }
    if (!userId || !entityId) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });

    const entityModuleIds = (
      await prisma.entityModule.findMany({ where: { entityId }, select: { moduleId: true } })
    ).map((m) => m.moduleId);

    if (action === 'link_all') {
      const ue = await prisma.userEntity.upsert({
        where: { userId_entityId: { userId, entityId } },
        create: { userId, entityId },
        update: {},
        select: { id: true },
      });
      await prisma.userEntityModule.createMany({
        data: entityModuleIds.map((moduleId) => ({ userEntityId: ue.id, moduleId, allowed: true })),
        skipDuplicates: true,
      });
      return NextResponse.json({ ok: true, action: 'link_all' });
    }

    if (action === 'unlink_all') {
      const ue = await prisma.userEntity.findUnique({
        where: { userId_entityId: { userId, entityId } },
        select: { id: true },
      });
      if (!ue?.id) return NextResponse.json({ ok: true, action: 'unlink_all' });
      await prisma.$transaction([
        prisma.userEntityModuleProgram.deleteMany({
          where: { userEntityModule: { userEntityId: ue.id, moduleId: { in: entityModuleIds } } },
        }),
        prisma.userEntityModule.deleteMany({ where: { userEntityId: ue.id, moduleId: { in: entityModuleIds } } }),
      ]);
      return NextResponse.json({ ok: true, action: 'unlink_all' });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
