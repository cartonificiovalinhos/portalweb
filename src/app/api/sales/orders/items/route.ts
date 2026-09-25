import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { validateOrderItemDimensionLimits } from '@/lib/order-item-dimension-limits';
import { resolveCommercialFamilyForItem } from '@/lib/commercial-family-dimension-resolution';
import { resolveClientItemDimensionCode } from '@/lib/client-item-dimension-code';
import { normalizeOptionalText } from '@/lib/sales-order-client-fields';
import { buildClientItemPriceFloorResolver } from '@/lib/client-item-price-floor';

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
    if (body.clientOrderNumber !== undefined) payload.clientOrderNumber = normalizeOptionalText(body.clientOrderNumber);
    if (body.clientItemCode !== undefined) payload.clientItemCode = normalizeOptionalText(body.clientItemCode);
    if (body.clientOrderItemNumber !== undefined) payload.clientOrderItemNumber = body.clientOrderItemNumber ? Number(body.clientOrderItemNumber) : null;
    if (body.itemDeliveryDate !== undefined) payload.itemDeliveryDate = body.itemDeliveryDate ? new Date(body.itemDeliveryDate) : null;
    if (body.internalResin !== undefined) payload.internalResin = Boolean(body.internalResin);
    if (body.externalResin !== undefined) payload.externalResin = Boolean(body.externalResin);
    if (body.creases !== undefined) payload.creases = body.creases;

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

        const candidate = await resolveCommercialFamilyForItem(prisma, {
          ...payload,
          inventoryItem: { commercialFamily: invItem.commercialFamily ?? null },
        });
        const dimensionError = validateOrderItemDimensionLimits(candidate);
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
      select: { clientId: true, customerDoc: true }
    });

    payload.clientItemCode = await resolveClientItemDimensionCode(prisma, {
      customerDoc: order?.customerDoc,
      sku: payload.sku,
      width: payload.width,
      length: payload.length,
      grammage: payload.grammage,
    });

    const clientId = order?.clientId != null ? Number(order.clientId) : null;
    const invId = payload.inventoryItemId != null ? Number(payload.inventoryItemId) : null;
    if (clientId && Number.isFinite(clientId) && clientId > 0 && invId && Number.isFinite(invId) && invId > 0) {
      const resolvePriceFloor = await buildClientItemPriceFloorResolver(prisma, Math.trunc(clientId), [Math.trunc(invId)]);
      const pricing = resolvePriceFloor(Math.trunc(invId), payload.unit ?? undefined);
      if (pricing.minAllowedPrice != null) {
        const cents = (n: number) => Math.round(Number(n || 0) * 100);
        const reqCents = cents(Number(payload.unitPrice ?? 0));
        const floorCents = cents(Number(pricing.minAllowedPrice ?? 0));

        if (!pricing.manual) {
          if (reqCents !== floorCents) {
            return NextResponse.json(
              { error: `Preço não pode ser alterado para item não manual: ${String(payload.sku || payload.name || 'Item')}` },
              { status: 400 }
            );
          }
        } else if (reqCents < floorCents) {
          return NextResponse.json(
            { error: `Preço não pode ser inferior ao preço mínimo permitido: ${String(payload.sku || payload.name || 'Item')}` },
            { status: 400 }
          );
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
        clientOrderNumber: payload.clientOrderNumber ?? null,
        clientItemCode: payload.clientItemCode ?? null,
        clientOrderItemNumber: payload.clientOrderItemNumber ?? null,
        itemDeliveryDate: payload.itemDeliveryDate ?? null,
        internalResin: payload.internalResin ?? false,
        externalResin: payload.externalResin ?? false,
        creases: payload.creases ?? null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
