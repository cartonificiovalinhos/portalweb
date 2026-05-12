import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
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

    const where: any = { order: { clientId: Math.trunc(clientId) } };
    if (filter === 'due' || filter === 'a_vencer' || filter === 'avencer') {
      where.dueDate = { gte: today };
    } else if (filter === 'overdue' || filter === 'vencidos' || filter === 'vencido') {
      where.dueDate = { lt: today };
    }

    const invoices = await prisma.salesOrderInvoice.findMany({
      where,
      select: {
        id: true,
        orderId: true,
        invoiceNumber: true,
        issueDate: true,
        dueDate: true,
        totalValue: true,
      },
      orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
    });

    return NextResponse.json(invoices);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
