import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../../lib/prisma';

function normalizeDoc(doc: string): string {
  return (doc || '').replace(/\D+/g, '');
}

// PATCH: Atualiza dados básicos do usuário
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = Number(params.id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const body = await request.json().catch(() => ({} as any));
    const update: any = {};
    if (body.name !== undefined) update.name = String(body.name);
    if (body.email !== undefined) update.email = body.email == null ? null : String(body.email);
    if (body.erpIntegrationMode !== undefined) update.erpIntegrationMode = String(body.erpIntegrationMode);
    if (body.doc !== undefined) update.doc = normalizeDoc(String(body.doc || '')) || null;
    if (body.password !== undefined && String(body.password).length > 0) {
      update.password = await bcrypt.hash(String(body.password), 10);
    }
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...update,
        salesRepAdmin: body.salesRepAdmin !== undefined ? Boolean(body.salesRepAdmin) : undefined,
        isSalesAdmin: body.isSalesAdmin !== undefined ? Boolean(body.isSalesAdmin) : undefined,
        twoFactorRequired: body.twoFactorRequired !== undefined ? Boolean(body.twoFactorRequired) : undefined,
      },
      select: { id: true, name: true, email: true, doc: true, createdAt: true, updatedAt: true, salesRepAdmin: true, isSalesAdmin: true, twoFactorRequired: true, erpIntegrationMode: true }
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// DELETE: Remove usuário e todos os vínculos relacionados
export async function DELETE(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = Number(params.id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { lastEntityId: null } });
      await tx.userEntityModuleProgram.deleteMany({ where: { userEntityModule: { userEntity: { userId: id } } } });
      await tx.userEntityModule.deleteMany({ where: { userEntity: { userId: id } } });
      await tx.userEntity.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true, deletedId: id });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
