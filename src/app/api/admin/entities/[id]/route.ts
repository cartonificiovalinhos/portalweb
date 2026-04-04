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
    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_ENTITIES');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const id = Number(params.id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const exists = await prisma.entity.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: 'Entidade não encontrada' }, { status: 404 });

    await prisma.$transaction([
      prisma.user.updateMany({ where: { lastEntityId: id }, data: { lastEntityId: null } }),
      prisma.userEntityModuleProgram.deleteMany({ where: { userEntityModule: { userEntity: { entityId: id } } } }),
      prisma.userEntityModule.deleteMany({ where: { userEntity: { entityId: id } } }),
      prisma.userEntity.deleteMany({ where: { entityId: id } }),
      prisma.entityModuleProgram.deleteMany({ where: { entityModule: { entityId: id } } }),
      prisma.entityModule.deleteMany({ where: { entityId: id } }),
      prisma.entity.delete({ where: { id } }),
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
    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_ENTITIES');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const id = Number(params.id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const exists = await prisma.entity.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: 'Entidade não encontrada' }, { status: 404 });

    const body = await request.json();
    const cnpj = String(body.cnpj || '').trim();
    const name = String(body.name || '').trim();
    if (!cnpj || !name) return NextResponse.json({ error: 'CNPJ e Nome obrigatórios' }, { status: 400 });
    const dup = await prisma.entity.findFirst({ where: { cnpj, id: { not: id } }, select: { id: true } });
    if (dup) return NextResponse.json({ error: 'CNPJ já cadastrado em outra entidade' }, { status: 409 });

    await prisma.entity.update({ where: { id }, data: { cnpj, name } });
    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
