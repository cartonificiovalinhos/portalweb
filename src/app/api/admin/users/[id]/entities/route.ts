import { NextResponse } from 'next/server';
// Rebuild trigger: Fix webpack runtime error
import { prisma } from '../../../../../../lib/prisma';

function normalizeDoc(doc: string): string {
  return (doc || '').replace(/\D+/g, '');
}
function normalizeCnpj(cnpj: string): string {
  return (cnpj || '').replace(/\D+/g, '');
}

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

// GET: Lista todas as entidades com flag se estão vinculadas ao usuário
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const url = new URL(request.url);
    const userDoc = normalizeDoc(String(url.searchParams.get('userDoc') || ''));
    let userId = Number(params.id);
    if (!userId && userDoc) {
      const u = await prisma.user.findUnique({ where: { doc: userDoc }, select: { id: true } });
      userId = Number(u?.id || 0);
    }
    if (!userId) return NextResponse.json({ error: 'userId inválido' }, { status: 400 });
    try {
      const [entities, links] = await Promise.all([
        prisma.entity.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, cnpj: true } }),
        prisma.userEntity.findMany({ where: { userId }, select: { entityId: true } }),
      ]);
      const linkedSet = new Set(links.map((l) => l.entityId));
      return NextResponse.json({
        entities: entities.map((e) => ({ ...e, linked: linkedSet.has(e.id) ? 1 : 0 })),
      });
    } catch (err: any) {
      // Fallback defensivo: se tabela de vínculo não existir ainda, retornar entidades sem vínculo
      console.warn('Fallback GET /api/admin/users/[id]/entities sem JOIN (provável tabela ausente):', err?.message || err);
      const ents = await prisma.entity.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, cnpj: true } });
      return NextResponse.json({ entities: ents.map((e) => ({ ...e, linked: 0 })) });
    }
  } catch (err: any) {
    console.error('GET /api/admin/users/[id]/entities error:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// PUT: Vincula/Desvincula entidade ao usuário
export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    let userId = Number(params.id);
    const body = await request.json();
    const userDoc = body?.userDoc ? normalizeDoc(String(body.userDoc)) : '';
    if (!userId && userDoc) {
      const u = await prisma.user.findUnique({ where: { doc: userDoc }, select: { id: true } });
      userId = Number(u?.id || 0);
    }
    if (!userId) return NextResponse.json({ error: 'userId inválido' }, { status: 400 });
    let entityId = Number(body?.entityId);
    const entityCnpj = body?.entityCnpj ? normalizeCnpj(String(body.entityCnpj)) : '';
    if (!entityId && entityCnpj) {
      entityId = await resolveEntityIdByCnpj(entityCnpj);
    }
    const linked = body?.linked === undefined ? true : Boolean(body?.linked);
    if (!entityId) return NextResponse.json({ error: 'entityId inválido' }, { status: 400 });

    // Verificar existência de entidade
    const eRow = await prisma.entity.findUnique({ where: { id: entityId }, select: { id: true } });
    if (!eRow) return NextResponse.json({ error: 'Entidade não encontrada' }, { status: 404 });

    const existing = await prisma.userEntity.findUnique({
      where: { userId_entityId: { userId, entityId } },
      select: { id: true },
    });
    if (linked) {
      if (!existing) await prisma.userEntity.create({ data: { userId, entityId } });
    } else {
      if (existing?.id) {
        await prisma.$transaction([
          prisma.userEntityModuleProgram.deleteMany({ where: { userEntityModule: { userEntityId: existing.id } } }),
          prisma.userEntityModule.deleteMany({ where: { userEntityId: existing.id } }),
          prisma.userEntity.delete({ where: { id: existing.id } }),
        ]);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
