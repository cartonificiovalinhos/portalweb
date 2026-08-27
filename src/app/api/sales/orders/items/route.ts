import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { validateOrderItemDimensionLimits } from '@/lib/order-item-dimension-limits';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderId = Number(body.orderId);
    if (!Number.isFinite(orderId) || orderId <= 0) return NextResponse.json({ error: 'orderId obrigatório' }, { status: 400 });

    const payload: Record<string, any> = {};
    if (body.inventoryItemId !== undefined) payload.inventoryItemId = Number(body.inventoryItemId) || null;
    if (body.sku !== undefined) payload.sku = String(body.sku || '').trim() || null;
    payload.name = String(body.name || 'Produto');
    payload.quantity = Number(body.quantity || 1);
    payload.unit = body.unit ? String(body.unit) : null;
    payload.unitPrice = Number(body.unitPrice || 0);
    payload.discountPct = Number(body.discountPct || 0);
    payload.lineTotal = payload.quantity * payload.unitPrice * (1 - (payload.discountPct || 0) / 100);
    if (body.width !== undefined) payload.width = Number(body.width || 0);
    if (body.length !== undefined) payload.length = Number(body.length || 0);
    if (body.grammage !== undefined) payload.grammage = Number(body.grammage || 0);
    if (body.diameter !== undefined) payload.diameter = Number(body.diameter || 0);
    if (body.tube !== undefined) payload.tube = Number(body.tube || 0);

    if (payload.inventoryItemId) {
      const invItem = await prisma.inventoryItem.findUnique({
        where: { id: payload.inventoryItemId },
        select: {
          id: true,
          width: true,
          length: true,
          grammage: true,
          commercialFamily: {
            select: {
              id: true,
              description: true,
              widthMin: true,
              widthMax: true,
              lengthMin: true,
              lengthMax: true,
            },
          },
        },
      });
      if (invItem) {
        if (payload.width === undefined) payload.width = invItem.width;
        if (payload.length === undefined) payload.length = invItem.length;
        if (payload.grammage === undefined) payload.grammage = invItem.grammage;

        const dimensionError = validateOrderItemDimensionLimits({
          ...payload,
          inventoryItem: { commercialFamily: invItem.commercialFamily ?? null },
        });
        if (dimensionError) {
          return NextResponse.json({ error: dimensionError }, { status: 400 });
        }
      }
    }

    if (!Number.isFinite(payload.unitPrice) || Number(payload.unitPrice) <= 0) {
      return NextResponse.json({ error: 'Não é permitido salvar item com preço zero.' }, { status: 400 });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id: Math.trunc(orderId) },
      select: { clientId: true }
    });

    const clientId = order?.clientId != null ? Number(order.clientId) : null;
    const invId = payload.inventoryItemId != null ? Number(payload.inventoryItemId) : null;
    if (clientId && Number.isFinite(clientId) && clientId > 0 && invId && Number.isFinite(invId) && invId > 0) {
      const link = await prisma.clientItem.findFirst({
        where: { clientId: Math.trunc(clientId), inventoryItemId: Math.trunc(invId), allowed: true },
        select: { unitPrice: true, manual: true },
      });

      if (link) {
        const cents = (n: number) => Math.round(Number(n || 0) * 100);
        const reqCents = cents(Number(payload.unitPrice ?? 0));
        const baseCents = cents(Number(link.unitPrice ?? 0));

        if (!link.manual) {
          if (reqCents !== baseCents) {
            return NextResponse.json(
              { error: `Preço não pode ser alterado para item não manual: ${String(payload.sku || payload.name || 'Item')}` },
              { status: 400 }
            );
          }
        } else {
          if (reqCents < baseCents) {
            return NextResponse.json(
              { error: `Preço não pode ser inferior ao valor carregado: ${String(payload.sku || payload.name || 'Item')}` },
              { status: 400 }
            );
          }
        }
      }
    }

    const created = await prisma.salesOrderItem.create({
      data: {
        orderId,
        inventoryItemId: payload.inventoryItemId ?? null,
        sku: payload.sku ?? null,
        name: payload.name,
        quantity: payload.quantity,
        unit: payload.unit ?? null,
        unitPrice: payload.unitPrice,
        discountPct: payload.discountPct,
        lineTotal: payload.lineTotal,
        width: payload.width ?? null,
        length: payload.length ?? null,
        grammage: payload.grammage ?? null,
        diameter: payload.diameter ?? null,
        tube: payload.tube ?? null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
