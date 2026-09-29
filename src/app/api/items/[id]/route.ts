import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { buildInventoryItemPatchData } from '@/lib/inventory-item-write';

// GET: retorna item por ID
export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = Number(params.id);
  if (!id || Number.isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  return NextResponse.json(item);
}

// PATCH: atualiza campos básicos do item
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = Number(params.id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const body = await request.json();
    const data = await buildInventoryItemPatchData(prisma, body);
    const updated = await prisma.inventoryItem.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// DELETE: exclui o item por ID
export async function DELETE(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = Number(params.id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    await prisma.inventoryItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
