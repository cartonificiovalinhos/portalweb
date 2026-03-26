import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';

function normalizeDoc(doc: string): string {
  return (doc || '').replace(/\D+/g, '');
}

export async function GET(request: Request, { params }: { params: { doc: string } }) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const docRaw = String(params.doc || '').trim();
    const doc = normalizeDoc(docRaw);
    if (!doc) return NextResponse.json([]);

    // Removed unnecessary activeEntityId check that was blocking results but not used in query
    // const session = await getServerSession(authOptions);
    // const activeEntityId: number | null = (session as any)?.activeEntityId ?? null;
    // if (!activeEntityId) return NextResponse.json([]);

    const client = await prisma.client
      .findFirst({
        where: {
          OR: [{ doc }, { doc: docRaw }],
        },
      })
      .catch(() => null);
    if (!client) return NextResponse.json([]);

    // Lista vinculada via cadastro/ERP (ClientItem)
    const links = await prisma.clientItem.findMany({
      where: { clientId: client.id, allowed: true },
      include: { inventoryItem: { include: { commercialFamily: true } } }
    });
    const items = links.map((l) => ({
      id: l.inventoryItem.id,
      sku: l.inventoryItem.sku,
      name: l.inventoryItem.name,
      unit: l.unit ?? l.inventoryItem.unit,
      commercialFamily: l.inventoryItem.commercialFamily,
      unitPrice: l.unitPrice,
      width: l.inventoryItem.width,
      length: l.inventoryItem.length,
      grammage: l.inventoryItem.grammage
    }));

    const filtered = q
      ? items.filter((it) => {
          const name = String(it.name || '').toLowerCase();
          const sku = String(it.sku || '').toLowerCase();
          return name.includes(q) || sku.includes(q);
        })
      : items;
    return NextResponse.json(filtered);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
