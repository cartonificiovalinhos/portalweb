import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json([]);

    const contacts = await prisma.clientContact.findMany({
      where: { clientId: Math.trunc(clientId) },
      include: { statuses: { select: { status: true } } },
      orderBy: [{ description: 'asc' }, { id: 'asc' }],
    });

    return NextResponse.json(
      contacts.map((c) => ({
        id: c.id,
        clientId: c.clientId,
        description: c.description,
        phone: c.phone,
        isWhatsapp: c.isWhatsapp,
        email: c.email,
        statuses: (c.statuses || []).map((s) => s.status),
      }))
    );
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });

    const description = String(body.description ?? '').trim();
    if (!description) return NextResponse.json({ error: 'Descrição Contato é obrigatória' }, { status: 400 });

    const phone = body.phone === undefined ? null : (String(body.phone ?? '').trim() || null);
    const isWhatsapp = Boolean(body.isWhatsapp);
    const email = body.email === undefined ? null : (String(body.email ?? '').trim() || null);

    const created = await prisma.clientContact.create({
      data: { clientId: Math.trunc(clientId), description, phone, isWhatsapp, email },
      include: { statuses: { select: { status: true } } },
    });

    return NextResponse.json(
      {
        id: created.id,
        clientId: created.clientId,
        description: created.description,
        phone: created.phone,
        isWhatsapp: created.isWhatsapp,
        email: created.email,
        statuses: (created.statuses || []).map((s) => s.status),
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
