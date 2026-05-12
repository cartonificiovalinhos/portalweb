import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../../lib/prisma';

function normalizeStatus(s: string): string {
  return String(s ?? '').trim();
}

export async function GET(_: Request, props: { params: Promise<{ id: string; contactId: string }> }) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    const contactId = Number(params.contactId);
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json({ error: 'Client inválido' }, { status: 400 });
    if (!Number.isFinite(contactId) || contactId <= 0) return NextResponse.json({ error: 'Contato inválido' }, { status: 400 });

    const contact = await prisma.clientContact.findUnique({
      where: { id: Math.trunc(contactId) },
      select: { id: true, clientId: true, statuses: { select: { status: true } } },
    });
    if (!contact) return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 });
    if (contact.clientId !== Math.trunc(clientId)) return NextResponse.json({ error: 'Contato não pertence ao cliente' }, { status: 403 });

    return NextResponse.json((contact.statuses || []).map((s) => s.status));
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PUT(request: Request, props: { params: Promise<{ id: string; contactId: string }> }) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    const contactId = Number(params.contactId);
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json({ error: 'Client inválido' }, { status: 400 });
    if (!Number.isFinite(contactId) || contactId <= 0) return NextResponse.json({ error: 'Contato inválido' }, { status: 400 });

    const contact = await prisma.clientContact.findUnique({
      where: { id: Math.trunc(contactId) },
      select: { id: true, clientId: true },
    });
    if (!contact) return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 });
    if (contact.clientId !== Math.trunc(clientId)) return NextResponse.json({ error: 'Contato não pertence ao cliente' }, { status: 403 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });

    const rawList = Array.isArray((body as any).statuses) ? ((body as any).statuses as any[]) : [];
    const normalized = rawList.map((s) => normalizeStatus(String(s ?? ''))).filter((s) => Boolean(s));
    const unique = Array.from(new Set(normalized));

    await prisma.$transaction(async (tx) => {
      await tx.clientContactStatus.deleteMany({ where: { contactId: contact.id } });
      if (unique.length > 0) {
        await tx.clientContactStatus.createMany({
          data: unique.map((status) => ({ contactId: contact.id, status })),
          skipDuplicates: true,
        });
      }
    });

    return NextResponse.json({ ok: true, statuses: unique });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
