import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    const body = await request.json();
    const inventoryItemId = Number(body.inventoryItemId);
    const qty = Number(body.quantity || 1);
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json({ error: 'clientId inválido' }, { status: 400 });
    if (!Number.isFinite(inventoryItemId) || inventoryItemId <= 0) return NextResponse.json({ error: 'inventoryItemId inválido' }, { status: 400 });

    const priceLink = await prisma.clientItem.findFirst({ where: { clientId, inventoryItemId } });
    const basePrice = priceLink?.unitPrice ?? 0;

    const existing = await prisma.clientCartItem.findFirst({ where: { clientId, inventoryItemId } });
    let row;
    if (existing) {
      row = await prisma.clientCartItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + (qty > 0 ? qty : 1), unitPrice: basePrice } });
    } else {
      row = await prisma.clientCartItem.create({ data: { clientId, inventoryItemId, quantity: qty > 0 ? qty : 1, unitPrice: basePrice } });
    }
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

