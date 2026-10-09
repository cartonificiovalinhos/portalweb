import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import bcrypt from 'bcryptjs';

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

export async function GET(_: Request, props: { params: Promise<{ doc: string }> }) {
  const params = await props.params;
  try {
    const raw = params.doc ?? '';
    const doc = normalizeDoc(raw);
    if (!doc) return NextResponse.json({ error: 'doc inválido' }, { status: 400 });
    const user = await prisma.user.findUnique({
      where: { doc },
      select: { id: true, name: true, email: true, doc: true, salesRepAdmin: true, createdAt: true, updatedAt: true },
    });
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    return NextResponse.json(user);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ doc: string }> }) {
  const params = await props.params;
  try {
    const raw = params.doc ?? '';
    const doc = normalizeDoc(raw);
    if (!doc) return NextResponse.json({ error: 'doc inválido' }, { status: 400 });
    const body = await request.json().catch(() => ({} as any));
    const current = await prisma.user.findUnique({
      where: { doc },
      select: { id: true, doc: true, email: true, salesRepAdmin: true },
    });
    if (!current) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    const data: any = {};
    if (body.name !== undefined) data.name = String(body.name);
    if (body.email !== undefined) data.email = normalizeOptionalEmail(body.email);
    if (body.doc !== undefined) data.doc = normalizeDoc(String(body.doc || '')) || null;
    if (body.salesRepAdmin !== undefined) data.salesRepAdmin = Boolean(body.salesRepAdmin);
    if (body.erpIntegrationMode !== undefined) data.erpIntegrationMode = String(body.erpIntegrationMode);
    if (body.password !== undefined && String(body.password).length > 0) {
      data.password = await bcrypt.hash(String(body.password), 10);
    }

    const nextDoc = data.doc !== undefined ? data.doc : current.doc;
    const nextEmail = data.email !== undefined ? data.email : current.email;
    const identifierError = validateUserIdentifier(nextDoc, nextEmail);
    if (identifierError) return NextResponse.json({ error: identifierError }, { status: 400 });

    if (data.doc) {
      const found = await prisma.user.findUnique({
        where: { doc: String(data.doc) },
        select: { id: true },
      }).catch(() => null);
      if (found && found.id !== current.id) {
        return NextResponse.json({ error: 'CPF/CNPJ já está vinculado a outro usuário.' }, { status: 400 });
      }
    }

    if (data.email) {
      const found = await prisma.user.findUnique({
        where: { email: String(data.email) },
        select: { id: true },
      }).catch(() => null);
      if (found && found.id !== current.id) {
        return NextResponse.json({ error: 'E-mail já está vinculado a outro usuário.' }, { status: 400 });
      }
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ message: 'Nada para atualizar' });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id: current.id },
        data,
        select: { id: true, name: true, email: true, doc: true, salesRepAdmin: true, createdAt: true, updatedAt: true },
      });

      const isRep = Boolean(current.salesRepAdmin) || Boolean(row.salesRepAdmin);
      if (isRep) {
        await tx.userInventoryItemPrice.deleteMany({ where: { userId: row.id } });
      }

      return row;
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
