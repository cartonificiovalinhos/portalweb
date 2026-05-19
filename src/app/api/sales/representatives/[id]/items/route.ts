import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';

function normalizeSku(v: any): string {
  return String(v ?? '').trim();
}

function normalizeUnit(v: any): string {
  return String(v ?? '').trim().toUpperCase();
}

function normalizeUnitPrice(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const repUserId = Number((params as any)?.id);
  const url = new URL(request.url);
  const debugParam = String(url.searchParams.get('debug') || '').trim().toLowerCase();
  const debug = debugParam === '1' || debugParam === 'true' || debugParam === 'yes';

  return NextResponse.json(
    {
      ok: false,
      error: 'Use POST para atualizar preços-base e reajustar preços do cliente.',
      repUserId: Number.isFinite(repUserId) ? repUserId : null,
      debug,
      exampleBody: [{ itemCode: 'CMC-B S', unit: 'KG', unitPrice: 12.8 }],
    },
    { status: 200 }
  );
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const url = new URL(request.url);
    const debugParam = String(url.searchParams.get('debug') || '').trim().toLowerCase();
    const debug = debugParam === '1' || debugParam === 'true' || debugParam === 'yes';

    const repUserId = Number(params.id);
    if (!Number.isFinite(repUserId) || repUserId <= 0) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const itemsRaw = Array.isArray(body) ? body : Array.isArray((body as any)?.items) ? (body as any).items : [];
    if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
      return NextResponse.json({ error: 'items vazio' }, { status: 400 });
    }

    const rep = await prisma.user.findUnique({
      where: { id: repUserId },
      select: { id: true, salesRepAdmin: true },
    });
    if (!rep) return NextResponse.json({ error: 'Representante não encontrado' }, { status: 404 });

    const cleaned = itemsRaw
      .map((it: any) => ({
        itemCode: normalizeSku(it?.itemCode ?? it?.sku ?? it?.item ?? it?.code),
        unit: normalizeUnit(it?.unit ?? it?.un),
        unitPrice: normalizeUnitPrice(it?.unitPrice ?? it?.price ?? it?.preco),
        oldBasePrice: normalizeUnitPrice(
          it?.oldBasePrice ??
            it?.oldUnitPrice ??
            it?.previousBasePrice ??
            it?.previousUnitPrice ??
            it?.oldPrice ??
            it?.previousPrice
        ),
      }))
      .filter((it: any) => Boolean(it.itemCode) && Boolean(it.unit));

    if (cleaned.length === 0) {
      return NextResponse.json({ error: 'Nenhum item válido (itemCode e unit são obrigatórios)' }, { status: 400 });
    }

    const skus = Array.from(new Set(cleaned.map((x: any) => x.itemCode)));
    const invs = await prisma.inventoryItem.findMany({
      where: { sku: { in: skus } },
      select: { id: true, sku: true },
    });
    const invBySku = new Map<string, number>();
    for (const inv of invs) {
      if (inv.sku) invBySku.set(String(inv.sku), Number(inv.id));
    }

    const results: any[] = [];
    await prisma.$transaction(async (tx) => {
      const repLinks = await tx.userClientRep.findMany({ where: { userId: repUserId }, select: { clientId: true } });
      const repClientIds = Array.from(
        new Set(repLinks.map((x) => Number(x.clientId)).filter((x) => Number.isFinite(x) && x > 0))
      );

      for (const it of cleaned) {
        const inventoryItemId = invBySku.get(it.itemCode);
        if (!inventoryItemId) {
          results.push({ itemCode: it.itemCode, unit: it.unit, success: false, error: 'SKU não encontrado no portal' });
          continue;
        }

        try {
          const previousRows = await tx.userInventoryItemPrice.findMany({
            where: { userId: repUserId, inventoryItemId },
            select: { id: true, unit: true, unitPrice: true },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          });
          const previousMatches = previousRows.filter((r) => normalizeUnit(r.unit) === it.unit);
          const previousPreferred =
            previousMatches.find((r) => String(r.unit || '').trim().toUpperCase() === it.unit) ?? previousMatches[0] ?? null;
          const newBasePrice = Number(it.unitPrice ?? 0);
          const oldBaseCandidates = previousMatches
            .map((r) => ({ id: r.id, price: Number(r.unitPrice ?? 0) }))
            .filter((x) => Number.isFinite(x.price) && x.price > 0);

          const oldBaseOverride = Number(it.oldBasePrice ?? 0);
          const oldBasePick = oldBaseCandidates.find((c) => c.price !== newBasePrice) ?? oldBaseCandidates[0] ?? null;
          const preferredOld = Number(previousPreferred?.unitPrice ?? 0);
          const oldBasePrice =
            Number.isFinite(oldBaseOverride) && oldBaseOverride > 0
              ? oldBaseOverride
              : Number.isFinite(preferredOld) && preferredOld > 0 && preferredOld !== newBasePrice
              ? preferredOld
              : Number(oldBasePick?.price ?? 0);

          const row = previousPreferred
            ? await tx.userInventoryItemPrice.update({
                where: { id: previousPreferred.id },
                data: { unit: it.unit, unitPrice: it.unitPrice },
                select: { id: true, userId: true, inventoryItemId: true, unit: true, unitPrice: true },
              })
            : await tx.userInventoryItemPrice.create({
                data: { userId: repUserId, inventoryItemId, unit: it.unit, unitPrice: it.unitPrice },
                select: { id: true, userId: true, inventoryItemId: true, unit: true, unitPrice: true },
              });

          const duplicateIds = previousMatches.map((r) => r.id).filter((id) => id !== row.id);
          if (duplicateIds.length > 0) {
            await tx.userInventoryItemPrice.deleteMany({ where: { id: { in: duplicateIds } } });
          }

          let adjustedClients = 0;
          let foundClients = 0;
          let skippedUnitMismatch = 0;
          let skippedInvalidRatio = 0;
          let skippedInvalidUpdatedPrice = 0;
          if (oldBasePrice > 0 && newBasePrice > 0) {
            if (repClientIds.length === 0) {
              foundClients = 0;
            } else {
              const clientLinks = await tx.clientItem.findMany({
                where: {
                  inventoryItemId,
                  allowed: true,
                  manual: true,
                  clientId: { in: repClientIds },
                },
                select: { id: true, unitPrice: true, unit: true, lastBasePrice: true },
              });
              foundClients = clientLinks.length;

              for (const cl of clientLinks) {
                const clientUnitNorm = normalizeUnit(cl.unit);
                if (clientUnitNorm && clientUnitNorm !== it.unit) {
                  skippedUnitMismatch += 1;
                  continue;
                }
                const currentClientPrice = Number(cl.unitPrice ?? 0);
                const clientLastBase = Number((cl as any).lastBasePrice ?? 0);
                const baseForRatio = Number.isFinite(clientLastBase) && clientLastBase > 0 ? clientLastBase : oldBasePrice;
                const ratio = (Number.isFinite(currentClientPrice) && currentClientPrice > 0) ? (currentClientPrice / baseForRatio) : 1;
                if (!Number.isFinite(ratio) || ratio <= 0) {
                  skippedInvalidRatio += 1;
                  continue;
                }
                const updatedClientPrice = newBasePrice * ratio;
                if (!Number.isFinite(updatedClientPrice) || updatedClientPrice <= 0) {
                  skippedInvalidUpdatedPrice += 1;
                  continue;
                }
                await tx.clientItem.update({
                  where: { id: cl.id },
                  data: { unitPrice: updatedClientPrice, lastBasePrice: newBasePrice, ...(clientUnitNorm ? {} : { unit: it.unit }) },
                });
                adjustedClients += 1;
              }
            }
          }

          results.push({ ...row, itemCode: it.itemCode, success: true });
          if (adjustedClients > 0) {
            (results[results.length - 1] as any).adjustedClients = adjustedClients;
          }
          if (debug) {
            (results[results.length - 1] as any).debug = {
              inventoryItemId,
              oldBasePrice,
              newBasePrice,
              oldBasePriceOverride: Number.isFinite(Number(it.oldBasePrice)) && Number(it.oldBasePrice) > 0 ? Number(it.oldBasePrice) : null,
              oldBasePreferred: Number.isFinite(preferredOld) && preferredOld > 0 ? preferredOld : null,
              oldBasePick: oldBasePick ? { id: oldBasePick.id, price: oldBasePick.price } : null,
              repLinkedClients: repClientIds.length,
              foundClients,
              adjustedClients,
              skippedUnitMismatch,
              skippedInvalidRatio,
              skippedInvalidUpdatedPrice,
            };
          }
        } catch (innerErr: any) {
          results.push({ itemCode: it.itemCode, unit: it.unit, success: false, error: String(innerErr?.message || innerErr) });
        }
      }
    });

    const okCount = results.filter((r) => r.success).length;
    const failCount = results.length - okCount;
    return NextResponse.json({ ok: true, upserted: okCount, failed: failCount, results });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
