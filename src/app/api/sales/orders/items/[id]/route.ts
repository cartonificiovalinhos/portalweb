import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';

function parseIdParam(raw: unknown): number | null {
  const s = String(raw ?? '').trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function computeWeightKgFromFields(it: { width?: number | null; length?: number | null; grammage?: number | null; quantity?: number | null }): number {
  const w = Number(it.width ?? 0);
  const l = Number(it.length ?? 0);
  const g = Number(it.grammage ?? 0);
  const q = Number(it.quantity ?? 0);
  if (w > 0 && l > 0 && g > 0 && q > 0) {
    const areaM2 = (l / 1000) * (w / 1000);
    const weightKg = (areaM2 * g * q) / 1000;
    return weightKg;
  }
  return 0;
}

function lineBase(it: { quantity?: number | null; unitPrice?: number | null; unit?: string | null; width?: number | null; length?: number | null; grammage?: number | null }): number {
  const qty = Number(it.quantity ?? 0);
  const price = Number(it.unitPrice ?? 0);
  const unitPriceUnit = String(it.unit || '').trim().toUpperCase();
  if (unitPriceUnit === 'KG') return computeWeightKgFromFields(it) * price;
  return qty * price;
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = parseIdParam(params.id);
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const item = await prisma.salesOrderItem.findUnique({
      where: { id },
      include: { inventoryItem: true }
    });
    if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    return NextResponse.json(item);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = parseIdParam(params.id);
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const current = await prisma.salesOrderItem.findUnique({ where: { id }, select: { unitPrice: true } });
    if (!current) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    if (Number(current.unitPrice ?? 0) <= 0) {
      return NextResponse.json({ error: 'Não é permitido salvar item com preço zero.' }, { status: 400 });
    }

    const body = await request.json();
    const allowed: Record<string, any> = {};
    if (body.quantity !== undefined) allowed.quantity = Number(body.quantity);
    if (body.width !== undefined) allowed.width = Number(body.width);
    if (body.length !== undefined) allowed.length = Number(body.length);
    if (body.grammage !== undefined) allowed.grammage = Number(body.grammage);
    if (body.diameter !== undefined) allowed.diameter = Number(body.diameter);
    if (body.tube !== undefined) allowed.tube = Number(body.tube);
    if (body.discountPct !== undefined) allowed.discountPct = Number(body.discountPct);
    if (body.clientOrderNumber !== undefined) allowed.clientOrderNumber = String(body.clientOrderNumber);
    if (body.clientOrderItemNumber !== undefined) allowed.clientOrderItemNumber = Number(body.clientOrderItemNumber);
    if (body.itemDeliveryDate !== undefined) allowed.itemDeliveryDate = body.itemDeliveryDate ? new Date(body.itemDeliveryDate) : null;
    if (body.internalResin !== undefined) allowed.internalResin = Boolean(body.internalResin);
    if (body.externalResin !== undefined) allowed.externalResin = Boolean(body.externalResin);
    if (body.creases !== undefined) allowed.creases = body.creases;

    const keys = Object.keys(allowed);
    if (keys.length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });

    const updated = await prisma.$transaction(async (tx) => {
      const after = await tx.salesOrderItem.update({
        where: { id },
        data: allowed,
      });
      const invId = after.inventoryItemId ? Number(after.inventoryItemId) : null;
      let commercialFamilyId: number | null = null;
      if (invId) {
        const inv = await tx.inventoryItem.findUnique({
          where: { id: invId },
          select: {
            commercialFamilyId: true,
          },
        });
        commercialFamilyId = inv?.commercialFamilyId != null ? Number(inv.commercialFamilyId) : null;
      }

      const base = lineBase(after);
      const disc = Number(after.discountPct ?? 0);
      const computedLineTotal = base * (1 - disc / 100);
      const saved = await tx.salesOrderItem.update({
        where: { id },
        data: { lineTotal: computedLineTotal },
      });
      return { ...saved, commercialFamilyId };
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = parseIdParam(params.id);
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      const item = await tx.salesOrderItem.findUnique({
        where: { id },
        select: { orderId: true }
      });

      if (!item) {
        throw new Error('Item não encontrado');
      }

      await tx.salesOrderItem.delete({
        where: { id }
      });

      // Recalcular totais do pedido
      const remainingItems = await tx.salesOrderItem.findMany({
        where: { orderId: item.orderId }
      });

      for (const it of remainingItems) {
        const base = lineBase(it);
        const disc = Number(it.discountPct ?? 0);
        const computedLineTotal = base * (1 - disc / 100);
        if (Number(it.lineTotal ?? 0) !== computedLineTotal) {
          await tx.salesOrderItem.update({ where: { id: it.id }, data: { lineTotal: computedLineTotal } });
        }
      }

      const subtotal = remainingItems.reduce((acc, it) => {
        return acc + lineBase(it);
      }, 0);
      const discountTotal = remainingItems.reduce((acc, it) => {
        return acc + (lineBase(it) * (Number(it.discountPct ?? 0) / 100));
      }, 0);
      const total = subtotal - discountTotal;

      await tx.salesOrder.update({
        where: { id: item.orderId },
        data: {
          subtotal,
          discountTotal,
          total
        }
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Erro ao excluir item:', err);
    const status = err.message === 'Item não encontrado' ? 404 : 500;
    return NextResponse.json({ error: String(err?.message || err) }, { status });
  }
}
