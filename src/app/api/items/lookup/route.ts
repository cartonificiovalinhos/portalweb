import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sku = String(body?.sku || body?.currentSku || body?.lookupSku || '').trim();
    if (!sku) return NextResponse.json({ error: 'SKU obrigatório' }, { status: 400 });

    const item = await prisma.inventoryItem.findUnique({
      where: { sku },
      include: { commercialFamily: true },
    });

    if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    return NextResponse.json(item);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
