import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const clientIdParam = url.searchParams.get('clientId');
    const clientId = clientIdParam ? Number(clientIdParam) : null;

    if (clientIdParam) {
      if (!Number.isFinite(clientId) || (clientId as number) <= 0) return NextResponse.json([]);
      let all: any[] = [];
      try {
        const links = await prisma.clientPaymentTerm.findMany({
          where: { clientId: clientId as number },
          include: { paymentTerm: true },
          orderBy: { position: 'asc' },
        });
        all = links.map((l) => l.paymentTerm).filter(Boolean);
      } catch {
        all = [];
      }

      if (all.length === 0) {
        try {
          const raw = await prisma.$queryRawUnsafe<any[]>(
            'SELECT pt.* FROM clientpaymentterm cpt JOIN paymentterm pt ON pt.id = cpt.paymentTermId WHERE cpt.clientId = ? ORDER BY cpt.position ASC',
            Math.trunc(clientId as number)
          );
          if (Array.isArray(raw) && raw.length > 0) all = raw;
        } catch {
          all = [];
        }
      }

      if (all.length === 0) {
        const c = await prisma.client.findUnique({
          where: { id: clientId as number },
          select: { paymentTermId: true }
        }).catch(() => null);
        const fallbackId = c?.paymentTermId ? Number(c.paymentTermId) : null;
        if (fallbackId && Number.isFinite(fallbackId) && fallbackId > 0) {
          const term = await prisma.paymentTerm.findUnique({ where: { id: fallbackId } }).catch(() => null);
          if (term) {
            all = [term];
          }
        }
      }
      const items = q
        ? all.filter(item =>
            item.description.toLowerCase().includes(q) ||
            (item.code !== null && String(item.code).includes(q))
          )
        : all;
      return NextResponse.json(items);
    }
    
    // Fetch all and filter in memory for simplicity and support for partial code match
    // PaymentTerms are usually few in number
    const all = await prisma.paymentTerm.findMany({
      orderBy: { description: 'asc' }
    });
    
    let items = all;
    if (q) {
      items = all.filter(item => 
        item.description.toLowerCase().includes(q) || 
        (item.code !== null && String(item.code).includes(q))
      );
    }
    
    return NextResponse.json(items);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = body.code !== undefined && body.code !== null ? Number(body.code) : null;
    const description = String(body.description || '').trim();
    const installments = body.installments !== undefined && body.installments !== null ? Number(body.installments) : 1;
    
    if (!description) return NextResponse.json({ error: 'Descrição é obrigatória' }, { status: 400 });

    const created = await prisma.paymentTerm.create({
      data: {
        code,
        description,
        installments
      }
    });
    
    return NextResponse.json(created);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
