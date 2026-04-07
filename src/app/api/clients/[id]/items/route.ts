import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

function normalizeDoc(doc: string): string {
  return (doc || '').replace(/\D+/g, '');
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json([]);

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const mode = (url.searchParams.get('mode') || '').trim().toLowerCase();
    const takeRaw = Number(url.searchParams.get('take') || 200);
    const take = Number.isFinite(takeRaw) ? Math.min(200, Math.max(1, takeRaw)) : 200;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, doc: true },
    }).catch(() => null);
    if (!client) return NextResponse.json([]);

    if (mode === 'unlinked') {
      const where: any = {
        clientItems: { none: { clientId: client.id, allowed: true } },
      };
      if (q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
        ];
      }

      const items = await prisma.inventoryItem.findMany({
        where,
        include: { commercialFamily: true },
        orderBy: { name: 'asc' },
        take,
      });

      return NextResponse.json(
        items.map((it) => ({
          id: it.id,
          sku: it.sku,
          name: it.name,
          unit: it.unit,
          commercialFamily: it.commercialFamily,
          unitPrice: null,
          width: it.width,
          length: it.length,
          grammage: it.grammage,
        }))
      );
    }

    const links = await prisma.clientItem.findMany({
      where: { clientId: client.id, allowed: true },
      include: { inventoryItem: { include: { commercialFamily: true } } }
    });

    let items = links.map((l) => ({
      id: l.inventoryItem.id,
      sku: l.inventoryItem.sku,
      name: l.inventoryItem.name,
      unit: l.unit ?? l.inventoryItem.unit,
      commercialFamily: l.inventoryItem.commercialFamily,
      unitPrice: l.unitPrice,
      width: l.inventoryItem.width,
      length: l.inventoryItem.length,
      grammage: l.inventoryItem.grammage
    }));

    if (items.length === 0) {
      const docDigits = normalizeDoc(String(client.doc || ''));
      const docRaw = String(client.doc || '').trim();
      const whereDoc = docDigits
        ? { OR: [{ customerDoc: docDigits }, ...(docRaw ? [{ customerDoc: docRaw }] : [])] }
        : docRaw
        ? { customerDoc: docRaw }
        : null;

      if (whereDoc) {
        const orders = await prisma.salesOrder.findMany({
          where: whereDoc as any,
          include: {
            items: {
              include: {
                inventoryItem: { include: { commercialFamily: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        }).catch(() => []);

        const byInvId = new Map<number, any>();
        for (const o of orders || []) {
          const orderItems: any[] = Array.isArray((o as any).items) ? (o as any).items : [];
          for (const it of orderItems) {
            const inv = it?.inventoryItem;
            const invId = Number(inv?.id);
            if (!Number.isFinite(invId) || invId <= 0) continue;
            if (byInvId.has(invId)) continue;
            byInvId.set(invId, {
              id: invId,
              sku: inv?.sku ?? null,
              name: String(inv?.name || it?.name || ''),
              unit: inv?.unit ?? it?.unit ?? null,
              commercialFamily: inv?.commercialFamily ?? null,
              unitPrice: Number(it?.unitPrice ?? inv?.unitPrice ?? 0),
              width: inv?.width ?? it?.width ?? null,
              length: inv?.length ?? it?.length ?? null,
              grammage: inv?.grammage ?? it?.grammage ?? null
            });
          }
        }
        items = Array.from(byInvId.values());
      }
    }

    const filtered = q
      ? items.filter((it: any) => {
          const name = String(it?.name || '').toLowerCase();
          const sku = String(it?.sku || '').toLowerCase();
          return name.includes(q) || sku.includes(q);
        })
      : items;

    return NextResponse.json(filtered);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// Upsert vínculo de item para cliente (usado pelo ERP)
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json({ error: 'clientId inválido' }, { status: 400 });

    const rawBody = await request.json();
    if (rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) && typeof (rawBody as any).action === 'string') {
      const action = String((rawBody as any).action || '').trim();

      if (action === 'unlink') {
        const inventoryItemIdsRaw = (rawBody as any).inventoryItemIds;
        const inventoryItemIds = Array.isArray(inventoryItemIdsRaw)
          ? inventoryItemIdsRaw.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x) && x > 0)
          : [];
        if (!inventoryItemIds.length) return NextResponse.json({ error: 'inventoryItemIds é obrigatório' }, { status: 400 });

        const del = await prisma.clientItem.deleteMany({
          where: { clientId, inventoryItemId: { in: inventoryItemIds } },
        });
        return NextResponse.json({ ok: true, deletedCount: del.count });
      }

      if (action === 'applyAdjust') {
        const repUserId = Number((rawBody as any).repUserId);
        const percent = Number((rawBody as any).percent);
        if (!Number.isFinite(repUserId) || repUserId <= 0) return NextResponse.json({ error: 'repUserId inválido' }, { status: 400 });
        if (!Number.isFinite(percent)) return NextResponse.json({ error: 'percent inválido' }, { status: 400 });

        const multiplier = 1 + percent / 100;
        const clientItems = await prisma.clientItem.findMany({
          where: { clientId, allowed: true },
          select: {
            id: true,
            inventoryItemId: true,
            unit: true,
            inventoryItem: { select: { unit: true } },
          },
        });

        const invIds = Array.from(new Set(clientItems.map((x) => x.inventoryItemId)));
        if (!invIds.length) return NextResponse.json({ ok: true, updatedCount: 0, skippedCount: 0 });

        const basePrices = await prisma.userInventoryItemPrice.findMany({
          where: { userId: repUserId, inventoryItemId: { in: invIds } },
          select: { inventoryItemId: true, unit: true, unitPrice: true },
        });

        const basePriceMap = new Map<string, number>();
        for (const bp of basePrices) {
          const unit = String(bp.unit || '').trim();
          if (!unit) continue;
          basePriceMap.set(`${bp.inventoryItemId}::${unit}`, Number(bp.unitPrice ?? 0));
        }

        let updatedCount = 0;
        let skippedCount = 0;
        await prisma.$transaction(async (tx) => {
          for (const row of clientItems) {
            const unit = String(row.unit ?? row.inventoryItem?.unit ?? '').trim();
            if (!unit) {
              skippedCount += 1;
              continue;
            }
            const base = basePriceMap.get(`${row.inventoryItemId}::${unit}`) ?? null;
            if (!base || base <= 0) {
              skippedCount += 1;
              continue;
            }

            await tx.clientItem.update({
              where: { id: row.id },
              data: { unitPrice: base * multiplier },
            });
            updatedCount += 1;
          }
        });

        return NextResponse.json({ ok: true, updatedCount, skippedCount });
      }
    }
    const isArrayPayload = Array.isArray(rawBody);
    const items = isArrayPayload ? rawBody : [rawBody];
    const results: any[] = [];

    if (isArrayPayload) {
      const withId: any[] = [];
      const withSku: { body: any; sku: string }[] = [];
      for (const body of items) {
        const inventoryItemId = Number(body?.inventoryItemId);
        if (Number.isFinite(inventoryItemId) && inventoryItemId > 0) {
          withId.push({ body, inventoryItemId });
          continue;
        }
        const sku = String(body?.itemCode || body?.sku || '').trim();
        if (!sku) return NextResponse.json({ error: 'inventoryItemId ou sku/itemCode é obrigatório' }, { status: 400 });
        withSku.push({ body, sku });
      }

      const skuList = Array.from(new Set(withSku.map((x) => x.sku)));
      const skuMap = new Map<string, number>();
      if (skuList.length) {
        const found = await prisma.inventoryItem.findMany({
          where: { sku: { in: skuList } },
          select: { id: true, sku: true },
        });
        for (const it of found) {
          if (it.sku) skuMap.set(it.sku, it.id);
        }
      }

      const normalized = new Map<number, any>();
      for (const { body, inventoryItemId } of withId) normalized.set(inventoryItemId, body);
      for (const { body, sku } of withSku) {
        const invId = skuMap.get(sku);
        if (!invId) return NextResponse.json({ error: `Item com código '${sku}' não encontrado` }, { status: 400 });
        normalized.set(invId, body);
      }

      const keepIds = Array.from(normalized.keys());
      const unlinkedCount = await prisma.$transaction(async (tx) => {
        for (const [inventoryItemId, body] of Array.from(normalized.entries())) {
          const unit = body.unit ? String(body.unit) : null;
          const unitPrice = Number(body.unitPrice ?? 0);
          const allowed = body.allowed === false ? false : true;

          const itemUpdate: any = {};
          if (body.width !== undefined) itemUpdate.width = Number(body.width);
          if (body.length !== undefined) itemUpdate.length = Number(body.length);
          if (body.grammage !== undefined) itemUpdate.grammage = Number(body.grammage);
          if (Object.keys(itemUpdate).length > 0) {
            await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: itemUpdate });
          }

          const row = await tx.clientItem.upsert({
            where: { clientId_inventoryItemId: { clientId, inventoryItemId } },
            update: { unit, unitPrice, allowed },
            create: { clientId, inventoryItemId, unit, unitPrice, allowed },
          });
          results.push({ ...row, success: true });
        }

        const del = keepIds.length
          ? await tx.clientItem.deleteMany({ where: { clientId, inventoryItemId: { notIn: keepIds } } })
          : await tx.clientItem.deleteMany({ where: { clientId } });
        return del.count;
      });

      if (results.length) (results[0] as any).unlinkedCount = unlinkedCount;
      else results.push({ success: true, unlinkedCount });

      return NextResponse.json(results, { status: 200 });
    }

    for (const body of items) {
      try {
        let inventoryItemId = Number(body.inventoryItemId);

        // Se não veio ID, tenta buscar pelo código (sku)
        if ((!inventoryItemId || isNaN(inventoryItemId)) && (body.itemCode || body.sku)) {
          const code = String(body.itemCode || body.sku);
          const item = await prisma.inventoryItem.findFirst({
            where: { sku: code }
          });
          if (item) {
            inventoryItemId = item.id;
          } else {
             results.push({ error: `Item com código '${code}' não encontrado`, success: false });
             continue;
          }
        }

        const unit = body.unit ? String(body.unit) : null;
        const unitPrice = Number(body.unitPrice ?? 0);
        const allowed = body.allowed === false ? false : true;

        if (!Number.isFinite(inventoryItemId) || inventoryItemId <= 0) {
            results.push({ error: 'inventoryItemId inválido', success: false });
            continue;
        }

        // Atualiza dados do item se fornecidos
        const itemUpdate: any = {};
        if (body.width !== undefined) itemUpdate.width = Number(body.width);
        if (body.length !== undefined) itemUpdate.length = Number(body.length);
        if (body.grammage !== undefined) itemUpdate.grammage = Number(body.grammage);
        
        if (Object.keys(itemUpdate).length > 0) {
            await prisma.inventoryItem.update({
                where: { id: inventoryItemId },
                data: itemUpdate
            });
        }

        const existing = await prisma.clientItem.findFirst({ where: { clientId, inventoryItemId } });
        const row = existing
          ? await prisma.clientItem.update({ where: { id: existing.id }, data: { unit, unitPrice, allowed } })
          : await prisma.clientItem.create({ data: { clientId, inventoryItemId, unit, unitPrice, allowed } });
        
        results.push({ ...row, success: true });
      } catch (innerErr: any) {
        results.push({ error: String(innerErr?.message || innerErr), success: false });
      }
    }

    return NextResponse.json(Array.isArray(rawBody) ? results : results[0], { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// Remover vínculo
export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const clientId = Number(params.id);
    const url = new URL(request.url);
    const inventoryItemId = Number(url.searchParams.get('inventoryItemId'));
    if (!Number.isFinite(clientId) || clientId <= 0) return NextResponse.json({ error: 'clientId inválido' }, { status: 400 });
    if (!Number.isFinite(inventoryItemId) || inventoryItemId <= 0) return NextResponse.json({ error: 'inventoryItemId inválido' }, { status: 400 });

    const existing = await prisma.clientItem.findFirst({ where: { clientId, inventoryItemId } });
    if (!existing) return NextResponse.json({ error: 'Vínculo não encontrado' }, { status: 404 });
    await prisma.clientItem.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
