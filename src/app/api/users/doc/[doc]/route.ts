import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import bcrypt from 'bcryptjs';

function normalizeDoc(doc: string): string {
  return (doc || '').replace(/\D+/g, '');
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
    const data: any = {};
    if (body.name !== undefined) data.name = String(body.name);
    if (body.email !== undefined) data.email = body.email == null ? null : String(body.email);
    if (body.doc !== undefined) data.doc = normalizeDoc(String(body.doc || '')) || null;
    if (body.salesRepAdmin !== undefined) data.salesRepAdmin = Boolean(body.salesRepAdmin);
    if (body.erpIntegrationMode !== undefined) data.erpIntegrationMode = String(body.erpIntegrationMode);
    if (body.password !== undefined && String(body.password).length > 0) {
      data.password = await bcrypt.hash(String(body.password), 10);
    }

    if (data.email !== undefined && data.email !== null && data.email !== '') {
      const found = await prisma.user.findUnique({ where: { email: String(data.email) }, select: { doc: true } }).catch(() => null);
      if (found && found.doc !== doc) data.email = null;
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ message: 'Nada para atualizar' });

    const updated = await prisma.user.update({
      where: { doc },
      data,
      select: { id: true, name: true, email: true, doc: true, salesRepAdmin: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
