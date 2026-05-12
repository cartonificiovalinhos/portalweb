import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';

export async function PATCH(request: Request, props: { params: Promise<{ id: string; contactId: string }> }) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    const contactId = Number(params.contactId);
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json({ error: 'Client inválido' }, { status: 400 });
    if (!Number.isFinite(contactId) || contactId <= 0) return NextResponse.json({ error: 'Contato inválido' }, { status: 400 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });

    const data: any = {};
    if (body.description !== undefined) {
      const d = String(body.description ?? '').trim();
      if (!d) return NextResponse.json({ error: 'Descrição Contato é obrigatória' }, { status: 400 });
      data.description = d;
    }
    if (body.phone !== undefined) data.phone = String(body.phone ?? '').trim() || null;
    if (body.isWhatsapp !== undefined) data.isWhatsapp = Boolean(body.isWhatsapp);
    if (body.email !== undefined) data.email = String(body.email ?? '').trim() || null;

    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });

    const updated = await prisma.clientContact.update({
      where: { id: Math.trunc(contactId) },
      data,
      include: { statuses: { select: { status: true } } },
    });
    if (updated.clientId !== Math.trunc(clientId)) return NextResponse.json({ error: 'Contato não pertence ao cliente' }, { status: 403 });

    return NextResponse.json({
      id: updated.id,
      clientId: updated.clientId,
      description: updated.description,
      phone: updated.phone,
      isWhatsapp: updated.isWhatsapp,
      email: updated.email,
      statuses: (updated.statuses || []).map((s) => s.status),
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, props: { params: Promise<{ id: string; contactId: string }> }) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    const contactId = Number(params.contactId);
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json({ error: 'Client inválido' }, { status: 400 });
    if (!Number.isFinite(contactId) || contactId <= 0) return NextResponse.json({ error: 'Contato inválido' }, { status: 400 });

    const existing = await prisma.clientContact.findUnique({
      where: { id: Math.trunc(contactId) },
      select: { id: true, clientId: true },
    });
    if (!existing) return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 });
    if (existing.clientId !== Math.trunc(clientId)) return NextResponse.json({ error: 'Contato não pertence ao cliente' }, { status: 403 });

    await prisma.clientContact.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
