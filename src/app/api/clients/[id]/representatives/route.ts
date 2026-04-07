import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json([]);

    const links = await prisma.userClientRep.findMany({
      where: { clientId },
      select: { user: { select: { id: true, name: true } } },
    });

    const byId = new Map<number, { id: number; name: string }>();
    for (const l of links) {
      const u = l.user;
      const id = Number(u?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (byId.has(id)) continue;
      byId.set(id, { id, name: String(u?.name || '') });
    }

    return NextResponse.json(Array.from(byId.values()));
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
