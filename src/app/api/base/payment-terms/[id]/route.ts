import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = Number(params.id);
    const body = await request.json();
    const data: any = {};
    if (body.code !== undefined) data.code = body.code !== null && body.code !== undefined ? Number(body.code) : null;
    if (body.description !== undefined) data.description = String(body.description || '').trim();
    if (body.installments !== undefined) data.installments = body.installments !== null && body.installments !== undefined ? Number(body.installments) : null;
    if (Object.keys(data).length === 0) return NextResponse.json({ message: 'Nada para atualizar' }, { status: 400 });
    const updated = await prisma.paymentTerm.update({
      where: { id },
      data,
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
    await prisma.paymentTerm.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
