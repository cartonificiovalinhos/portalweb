import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

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
    const data: any = {};
    if (body.name !== undefined) data.name = String(body.name || '').trim();
    if (body.sku !== undefined) data.sku = String(body.sku || '').trim();
    if (body.unit !== undefined) data.unit = String(body.unit || '').trim();
    if (body.width !== undefined) data.width = body.width === null || body.width === '' ? null : Number(body.width);
    if (body.length !== undefined) data.length = body.length === null || body.length === '' ? null : Number(body.length);
    if (body.grammage !== undefined) data.grammage = body.grammage === null || body.grammage === '' ? null : Number(body.grammage);
    if (body.commercialFamilyId !== undefined) {
      const cfid = Number(body.commercialFamilyId);
      if (Number.isFinite(cfid) && cfid > 0) {
        const exists = await prisma.commercialFamily.findUnique({ where: { id: cfid } });
        data.commercialFamilyId = exists ? cfid : null;
      } else {
        data.commercialFamilyId = null;
      }
    }
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
