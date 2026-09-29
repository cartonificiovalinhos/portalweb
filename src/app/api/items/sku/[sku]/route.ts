import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { buildInventoryItemPatchData } from '@/lib/inventory-item-write';

export async function GET(_: Request, props: { params: Promise<{ sku: string }> }) {
  const params = await props.params;
  try {
    const raw = params.sku ?? '';
    const sku = decodeURIComponent(raw).trim();
    if (!sku) return NextResponse.json({ error: 'SKU obrigatório' }, { status: 400 });
    const item = await prisma.inventoryItem.findUnique({ where: { sku }, include: { commercialFamily: true } });
    if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    return NextResponse.json(item);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ sku: string }> }) {
  const params = await props.params;
  try {
    const raw = params.sku ?? '';
    const sku = decodeURIComponent(raw).trim();
    if (!sku) return NextResponse.json({ error: 'SKU obrigatório' }, { status: 400 });
    const body = await request.json();
    const exists = await prisma.inventoryItem.findUnique({ where: { sku } });
    if (!exists) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    const data = await buildInventoryItemPatchData(prisma, body);
    const updated = await prisma.inventoryItem.update({ where: { sku }, data });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, props: { params: Promise<{ sku: string }> }) {
  const params = await props.params;
  try {
    const raw = params.sku ?? '';
    const sku = decodeURIComponent(raw).trim();
    if (!sku) return NextResponse.json({ error: 'SKU obrigatório' }, { status: 400 });
    const exists = await prisma.inventoryItem.findUnique({ where: { sku } });
    if (!exists) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    await prisma.inventoryItem.delete({ where: { sku } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
