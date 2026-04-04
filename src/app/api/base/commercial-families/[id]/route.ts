import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = Number(params.id);
    const body = await request.json();
    const data: any = {};
    if (body.description !== undefined) data.description = String(body.description || '').trim();
    if (body.erpCode !== undefined) data.erpCode = body.erpCode === null ? null : String(body.erpCode).trim();
    if (body.priceBy !== undefined) data.priceBy = String(body.priceBy || '').trim().toUpperCase();
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    if (data.priceBy !== undefined && !['UNIT', 'WEIGHT'].includes(data.priceBy)) return NextResponse.json({ error: 'Preço Por inválido' }, { status: 400 });
    const updated = await prisma.commercialFamily.update({
      where: { id },
      data,
      select: { id: true, description: true, erpCode: true, priceBy: true },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = Number(params.id);
    await prisma.commercialFamily.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
