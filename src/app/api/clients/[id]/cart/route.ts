import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json([]);

    const items = await prisma.clientCartItem.findMany({
      where: { clientId },
      include: { inventoryItem: true },
      orderBy: { updatedAt: 'desc' }
    });
    const out = items.map((c) => ({
      id: c.id,
      inventoryItemId: c.inventoryItemId,
      name: c.inventoryItem?.name ?? '',
      sku: c.inventoryItem?.sku ?? null,
      unit: c.inventoryItem?.unit ?? null,
      quantity: c.quantity,
      unitPrice: c.unitPrice
    }));
    return NextResponse.json(out);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

