import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfTomorrow(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json([]);

    const url = new URL(request.url);
    const filter = String(url.searchParams.get('filter') || 'all').trim().toLowerCase();
    const today = startOfToday();
    const tomorrow = startOfTomorrow();

    const where: any = { clientId: Math.trunc(clientId) };
    if (filter === 'due' || filter === 'a_vencer' || filter === 'avencer') {
      where.dueDate = { gte: tomorrow };
      where.status = { not: 'PAGA' };
    } else if (filter === 'overdue' || filter === 'vencidos' || filter === 'vencido') {
      where.dueDate = { lte: today };
      where.status = { not: 'PAGA' };
    }

    const invoices = await prisma.clientInvoice.findMany({
      where,
      select: {
        id: true,
        clientId: true,
        invoiceNumber: true,
        issueDate: true,
        dueDate: true,
        status: true,
        totalValue: true,
      },
      orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
    });

    return NextResponse.json(invoices);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
