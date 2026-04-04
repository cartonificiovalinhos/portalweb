import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../../lib/prisma';

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string, itemId: string }> }
) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    const inventoryItemId = Number(params.itemId);
    const body = await request.json();
    const quantity = Number(body.quantity ?? 1);
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json({ error: 'clientId inválido' }, { status: 400 });
    if (!Number.isFinite(inventoryItemId) || inventoryItemId <= 0) return NextResponse.json({ error: 'inventoryItemId inválido' }, { status: 400 });

    const existing = await prisma.clientCartItem.findFirst({ where: { clientId, inventoryItemId } });
    if (!existing) return NextResponse.json({ error: 'Item não está no carrinho' }, { status: 404 });
    if (quantity <= 0) {
      await prisma.clientCartItem.delete({ where: { id: existing.id } });
      return NextResponse.json({ ok: true });
    }
    const row = await prisma.clientCartItem.update({ where: { id: existing.id }, data: { quantity } });
    return NextResponse.json(row);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string, itemId: string }> }
) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    const inventoryItemId = Number(params.itemId);
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json({ error: 'clientId inválido' }, { status: 400 });
    if (!Number.isFinite(inventoryItemId) || inventoryItemId <= 0) return NextResponse.json({ error: 'inventoryItemId inválido' }, { status: 400 });

    const existing = await prisma.clientCartItem.findFirst({ where: { clientId, inventoryItemId } });
    if (!existing) return NextResponse.json({ error: 'Item não está no carrinho' }, { status: 404 });
    await prisma.clientCartItem.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

