import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json([]);

    const [current, history] = await Promise.all([
      prisma.salesOrder.findMany({
        where: { clientId: Math.trunc(clientId), status: { not: null } },
        distinct: ['status'],
        select: { status: true },
      }),
      prisma.salesOrderStatusHistory.findMany({
        where: { order: { clientId: Math.trunc(clientId) } },
        distinct: ['status'],
        select: { status: true },
      }),
    ]);

    const all = new Set<string>();
    for (const r of current) if (r.status) all.add(String(r.status).trim());
    for (const r of history) if (r.status) all.add(String(r.status).trim());

    return NextResponse.json(Array.from(all).filter((s) => Boolean(s)).sort((a, b) => a.localeCompare(b)));
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
