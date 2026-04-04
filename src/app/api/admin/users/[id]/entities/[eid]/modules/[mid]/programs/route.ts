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

async function ensureUserEntityModuleId(userEntityId: number, moduleId: number): Promise<number | null> {
  const ueId = Number(userEntityId);
  const mId = Number(moduleId);
  if (!Number.isFinite(ueId) || ueId <= 0) return null;
  if (!Number.isFinite(mId) || mId <= 0) return null;
  await prisma.$executeRawUnsafe(
    'DELETE FROM userentitymodule WHERE userEntityId = ? AND moduleId = ? AND id IS NULL',
    Math.trunc(ueId),
    Math.trunc(mId),
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    'INSERT IGNORE INTO userentitymodule (userEntityId, moduleId, allowed) VALUES (?, ?, 1)',
    Math.trunc(ueId),
    Math.trunc(mId),
  ).catch(() => {});
  await prisma.$executeRawUnsafe(
    'UPDATE userentitymodule SET allowed = 1 WHERE userEntityId = ? AND moduleId = ?',
    Math.trunc(ueId),
    Math.trunc(mId),
  ).catch(() => {});
  const rows = await prisma
    .$queryRawUnsafe<any[]>(
      'SELECT id FROM userentitymodule WHERE userEntityId = ? AND moduleId = ? AND id IS NOT NULL ORDER BY id DESC LIMIT 1',
      Math.trunc(ueId),
      Math.trunc(mId),
    )
    .catch(() => null);
  const id = rows?.[0]?.id ?? null;
  return id === null || id === undefined ? null : Number(id);
}

async function getAllowedProgramIdSet(userEntityModuleId: number, programIds: number[]): Promise<Set<number>> {
  const out = new Set<number>();
  const uemId = Number(userEntityModuleId);
  if (!Number.isFinite(uemId) || uemId <= 0) return out;
  if (!Array.isArray(programIds) || programIds.length === 0) return out;
  const list = programIds.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n) && n > 0);
  if (list.length === 0) return out;
  const placeholders = list.map(() => '?').join(',');
  const rows = await prisma
    .$queryRawUnsafe<any[]>(
      `SELECT programId FROM userentitymoduleprogram WHERE userEntityModuleId = ? AND allowed = 1 AND programId IN (${placeholders})`,
      Math.trunc(uemId),
      ...list,
    )
    .catch(() => []);
  for (const r of rows || []) {
    const pid = r?.programId;
    const n = pid === null || pid === undefined ? NaN : Number(pid);
    if (Number.isFinite(n)) out.add(Math.trunc(n));
  }
  return out;
}

// GET: Lista programas vinculados à entidade/módulo e flag se estão permitidos ao usuário
export async function GET(
  request: Request,
  props: { params: Promise<{ id: string; eid: string; mid: string }> }
) {
  const params = await props.params;
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

    const emps = await prisma.entityModuleProgram.findMany({
      where: { entityModuleId: entityModule.id },
      include: { program: { select: { id: true, code: true, name: true } } },
      orderBy: { programId: 'asc' },
    });

    const programIds = emps.map((p) => p.programId);
    const uemId = userEntity?.id ? await ensureUserEntityModuleId(userEntity.id, moduleId) : null;
    const userAllowedSet = uemId ? await getAllowedProgramIdSet(uemId, programIds) : new Set<number>();

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
export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string; eid: string; mid: string }> }
) {
  const params = await props.params;
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
      const uemId = await ensureUserEntityModuleId(ue.id, moduleId);
      if (!uemId) return NextResponse.json({ error: 'Falha ao vincular módulo ao usuário (schema/dados inválidos)' }, { status: 500 });
      await prisma.$executeRawUnsafe(
        'INSERT IGNORE INTO userentitymoduleprogram (userEntityModuleId, programId, allowed) VALUES (?, ?, 1)',
        Math.trunc(uemId),
        Math.trunc(programId),
      ).catch(() => {});
      await prisma.$executeRawUnsafe(
        'UPDATE userentitymoduleprogram SET allowed = 1 WHERE userEntityModuleId = ? AND programId = ?',
        Math.trunc(uemId),
        Math.trunc(programId),
      ).catch(() => {});
    } else {
      const ue = await prisma.userEntity.findUnique({
        where: { userId_entityId: { userId, entityId } },
        select: { id: true },
      });
      if (!ue?.id) return NextResponse.json({ ok: true });
      const uemId = await ensureUserEntityModuleId(ue.id, moduleId);
      if (!uemId) return NextResponse.json({ ok: true });
      await prisma.$executeRawUnsafe(
        'DELETE FROM userentitymoduleprogram WHERE userEntityModuleId = ? AND programId = ?',
        Math.trunc(uemId),
        Math.trunc(programId),
      ).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// PATCH: Operações em lote para programas do usuário dentro da entidade/módulo
export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string; eid: string; mid: string }> }
) {
  const params = await props.params;
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

    const uemId = await ensureUserEntityModuleId(ue.id, moduleId);
    if (!uemId) return NextResponse.json({ ok: true, action });

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
      const ids = empPrograms.map((p) => Number(p.programId)).filter((n) => Number.isFinite(n) && n > 0);
      if (ids.length > 0) {
        await prisma.userEntityModuleProgram.createMany({
          data: ids.map((pid) => ({ userEntityModuleId: uemId, programId: pid, allowed: true })),
          skipDuplicates: true,
        });
        await prisma.userEntityModuleProgram.updateMany({
          where: { userEntityModuleId: uemId, programId: { in: ids } },
          data: { allowed: true },
        });
      }
      return NextResponse.json({ ok: true, action: 'link_all' });
    }

    if (action === 'unlink_all') {
      // Remove todos os programas vinculados ao usuário para este módulo
      await prisma.userEntityModuleProgram.deleteMany({ where: { userEntityModuleId: uemId } });
      return NextResponse.json({ ok: true, action: 'unlink_all' });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
