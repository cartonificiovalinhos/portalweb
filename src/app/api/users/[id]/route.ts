import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../../lib/prisma';

function normalizeDoc(doc: string): string {
  return (doc || '').replace(/\D+/g, '');
}

function normalizeOptionalEmail(email: unknown): string | null {
  const value = String(email ?? '').trim();
  return value || null;
}

function validateUserIdentifier(doc: string | null, email: string | null): string | null {
  if (!doc && !email) {
    return 'Informe CPF/CNPJ ou E-mail.';
  }
  return null;
}

function mapUserWriteError(err: unknown): string | null {
  const code = typeof err === 'object' && err !== null ? String((err as any).code || '') : '';
  const message = String((err as any)?.message || err || '');
  if (code === 'P2002' || message.includes('User_email_key')) {
    const target = Array.isArray((err as any)?.meta?.target)
      ? (err as any).meta.target.map((item: unknown) => String(item).toLowerCase())
      : [];
    if (target.includes('doc') || message.includes('User_doc_key')) {
      return 'CPF/CNPJ já está vinculado a outro usuário.';
    }
    return 'E-mail já está vinculado a outro usuário.';
  }
  return null;
}

// PATCH: Atualiza dados básicos do usuário
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = Number(params.id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const body = await request.json().catch(() => ({} as any));
    const current = await prisma.user.findUnique({
      where: { id },
      select: { id: true, doc: true, email: true },
    });
    if (!current) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    const update: any = {};
    if (body.name !== undefined) update.name = String(body.name);
    if (body.email !== undefined) update.email = normalizeOptionalEmail(body.email);
    if (body.erpIntegrationMode !== undefined) update.erpIntegrationMode = String(body.erpIntegrationMode);
    if (body.doc !== undefined) update.doc = normalizeDoc(String(body.doc || '')) || null;
    if (body.password !== undefined && String(body.password).length > 0) {
      update.password = await bcrypt.hash(String(body.password), 10);
    }

    const nextDoc = update.doc !== undefined ? update.doc : current.doc;
    const nextEmail = update.email !== undefined ? update.email : current.email;
    const identifierError = validateUserIdentifier(nextDoc, nextEmail);
    if (identifierError) return NextResponse.json({ error: identifierError }, { status: 400 });

    if (update.doc) {
      const found = await prisma.user.findUnique({
        where: { doc: String(update.doc) },
        select: { id: true },
      }).catch(() => null);
      if (found && found.id !== id) {
        return NextResponse.json({ error: 'CPF/CNPJ já está vinculado a outro usuário.' }, { status: 400 });
      }
    }

    if (update.email) {
      const found = await prisma.user.findUnique({
        where: { email: String(update.email) },
        select: { id: true },
      }).catch(() => null);
      if (found && found.id !== id) {
        return NextResponse.json({ error: 'E-mail já está vinculado a outro usuário.' }, { status: 400 });
      }
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
    const mappedError = mapUserWriteError(err);
    if (mappedError) {
      return NextResponse.json({ error: mappedError }, { status: 400 });
    }
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
