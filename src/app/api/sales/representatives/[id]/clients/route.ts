import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = Number(params.id);
    if (!userId) return NextResponse.json({ error: 'userId inválido' }, { status: 400 });
    const links = await prisma.userClientRep.findMany({
      where: { userId },
      include: {
        client: {
          select: { id: true, doc: true, name: true, cep: true, logradouro: true, numero: true, bairro: true, cidade: true, estado: true },
        },
      },
      orderBy: { client: { name: 'asc' } },
    });
    const clients = links.map((l) => l.client).filter(Boolean);
    return NextResponse.json(clients);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = Number(params.id);
    if (!userId) return NextResponse.json({ error: 'userId inválido' }, { status: 400 });
    const body = await request.json().catch(() => ({} as any));
    const clientIds: number[] = Array.isArray(body?.clientIds) ? (body.clientIds as any[]).map((x) => Number(x)).filter((n) => !!n) : [];
    const action: string = String(body?.action || '').toLowerCase();
    if (!clientIds.length) return NextResponse.json({ error: 'clientIds vazio' }, { status: 400 });
    if (!['link', 'unlink'].includes(action)) return NextResponse.json({ error: 'action inválido' }, { status: 400 });

    if (action === 'link') {
      await prisma.userClientRep.createMany({
        data: clientIds.map((clientId) => ({ userId, clientId })),
        skipDuplicates: true,
      });
      return NextResponse.json({ ok: true, linked: clientIds.length });
    } else {
      await prisma.userClientRep.deleteMany({ where: { userId, clientId: { in: clientIds } } });
      return NextResponse.json({ ok: true, unlinked: clientIds.length });
    }
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
