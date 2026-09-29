import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';

function normalizeDoc(v: any): string {
  return String(v ?? '').replace(/\D+/g, '');
}

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

async function resolveRepresentative(rawId: string) {
  const raw = String(rawId ?? '').trim();
  const doc = normalizeDoc(raw);

  // CPF/CNPJ tem prioridade quando o identificador tem tamanho típico de documento.
  if (doc.length === 11 || doc.length === 14) {
    const byDoc = await prisma.user.findUnique({
      where: { doc },
      select: { id: true, doc: true, salesRepAdmin: true },
    });
    if (byDoc) return byDoc;
  }

  const numericId = Number(raw);
  if (Number.isFinite(numericId) && numericId > 0) {
    const byId = await prisma.user.findUnique({
      where: { id: numericId },
      select: { id: true, doc: true, salesRepAdmin: true },
    });
    if (byId) return byId;
  }

  if (doc) {
    return prisma.user.findUnique({
      where: { doc },
      select: { id: true, doc: true, salesRepAdmin: true },
    });
  }

  return null;
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const rep = await resolveRepresentative(String((params as any)?.id ?? ''));
  const url = new URL(request.url);
  const debugParam = String(url.searchParams.get('debug') || '').trim().toLowerCase();
  const debug = debugParam === '1' || debugParam === 'true' || debugParam === 'yes';

  return NextResponse.json(
    {
      ok: false,
      error: 'Use POST para atualizar preços-base e reajustar preços do cliente.',
      repUserId: Number.isFinite(Number(rep?.id)) ? Number(rep?.id) : null,
      repDoc: rep?.doc ?? null,
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

    const rep = await resolveRepresentative(params.id);
    if (!rep) return NextResponse.json({ error: 'Representante não encontrado' }, { status: 404 });
    const repUserId = Number(rep.id);

    const body = await request.json().catch(() => null);
    const itemsRaw = Array.isArray(body) ? body : Array.isArray((body as any)?.items) ? (body as any).items : null;
    if (!Array.isArray(itemsRaw)) {
      return NextResponse.json({ error: 'items inválido' }, { status: 400 });
    }

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

    if (itemsRaw.length > 0 && cleaned.length === 0) {
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
    let removedRepresentativeItems = 0;
    let removedClientLinks = 0;
    let preservedClientLinks = 0;
    await prisma.$transaction(async (tx) => {
      const repLinks = await tx.userClientRep.findMany({ where: { userId: repUserId }, select: { clientId: true } });
      const repClientIds = Array.from(
        new Set(repLinks.map((x) => Number(x.clientId)).filter((x) => Number.isFinite(x) && x > 0))
      );
      const existingRepRows = await tx.userInventoryItemPrice.findMany({
        where: { userId: repUserId },
        select: { id: true, inventoryItemId: true, unit: true, unitPrice: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      });
      const incomingInventoryItemIds = new Set<number>();

      for (const it of cleaned) {
        const inventoryItemId = invBySku.get(it.itemCode);
        if (!inventoryItemId) {
          results.push({ itemCode: it.itemCode, unit: it.unit, success: false, error: 'SKU não encontrado no portal' });
          continue;
        }
        incomingInventoryItemIds.add(inventoryItemId);

        try {
          const previousRows = existingRepRows.filter((row) => Number(row.inventoryItemId) === inventoryItemId);
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
          const existingRowIndex = existingRepRows.findIndex((r) => r.id === row.id);
          if (existingRowIndex >= 0) {
            existingRepRows[existingRowIndex] = { ...existingRepRows[existingRowIndex], unit: row.unit, unitPrice: row.unitPrice };
          } else {
            existingRepRows.push({ id: row.id, inventoryItemId, unit: row.unit, unitPrice: row.unitPrice });
          }
          for (let idx = existingRepRows.length - 1; idx >= 0; idx -= 1) {
            if (duplicateIds.includes(existingRepRows[idx].id)) existingRepRows.splice(idx, 1);
          }

          let adjustedClients = 0;
          let foundClients = 0;
          let skippedUnitMismatch = 0;
          let skippedInvalidRatio = 0;
          let skippedInvalidUpdatedPrice = 0;
          if (oldBasePrice > 0 && newBasePrice > 0 && oldBasePrice !== newBasePrice) {
            if (repClientIds.length === 0) {
              foundClients = 0;
            } else {
              const clientLinks = await tx.clientItem.findMany({
                where: {
                  inventoryItemId,
                  allowed: true,
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

      const removedRepRows = existingRepRows.filter((row) => !incomingInventoryItemIds.has(Number(row.inventoryItemId)));
      const removedRepRowIds = removedRepRows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
      const removedInventoryItemIds = Array.from(
        new Set(
          removedRepRows
            .map((row) => Number(row.inventoryItemId))
            .filter((inventoryItemId) => Number.isFinite(inventoryItemId) && inventoryItemId > 0)
        )
      );

      if (removedRepRowIds.length > 0) {
        removedRepresentativeItems = (
          await tx.userInventoryItemPrice.deleteMany({
            where: { id: { in: removedRepRowIds } },
          })
        ).count;
      }

      if (repClientIds.length > 0 && removedInventoryItemIds.length > 0) {
        const otherRepLinks = await tx.userClientRep.findMany({
          where: {
            clientId: { in: repClientIds },
            userId: { not: repUserId },
          },
          select: { clientId: true, userId: true },
        });
        const otherRepIds = Array.from(
          new Set(otherRepLinks.map((link) => Number(link.userId)).filter((userId) => Number.isFinite(userId) && userId > 0))
        );
        const otherRepSupportSet = new Set<string>();
        if (otherRepIds.length > 0) {
          const otherRepPrices = await tx.userInventoryItemPrice.findMany({
            where: {
              userId: { in: otherRepIds },
              inventoryItemId: { in: removedInventoryItemIds },
            },
            select: { userId: true, inventoryItemId: true },
          });
          for (const price of otherRepPrices) {
            otherRepSupportSet.add(`${price.userId}::${price.inventoryItemId}`);
          }
        }

        const otherRepIdsByClient = new Map<number, number[]>();
        for (const link of otherRepLinks) {
          const clientId = Number(link.clientId);
          const userId = Number(link.userId);
          if (!Number.isFinite(clientId) || clientId <= 0 || !Number.isFinite(userId) || userId <= 0) continue;
          const list = otherRepIdsByClient.get(clientId) || [];
          list.push(userId);
          otherRepIdsByClient.set(clientId, list);
        }

        const clientRows = await tx.clientItem.findMany({
          where: {
            clientId: { in: repClientIds },
            inventoryItemId: { in: removedInventoryItemIds },
          },
          select: { id: true, clientId: true, inventoryItemId: true },
        });

        const clientItemIdsToDelete: number[] = [];
        for (const row of clientRows) {
          const clientId = Number(row.clientId);
          const inventoryItemId = Number(row.inventoryItemId);
          const otherUsers = otherRepIdsByClient.get(clientId) || [];
          const hasOtherSupport = otherUsers.some((userId) => otherRepSupportSet.has(`${userId}::${inventoryItemId}`));
          if (hasOtherSupport) {
            preservedClientLinks += 1;
            continue;
          }
          clientItemIdsToDelete.push(Number(row.id));
        }

        if (clientItemIdsToDelete.length > 0) {
          removedClientLinks = (
            await tx.clientItem.deleteMany({
              where: { id: { in: clientItemIdsToDelete } },
            })
          ).count;
        }
      }
    });

    const okCount = results.filter((r) => r.success).length;
    const failCount = results.length - okCount;
    return NextResponse.json({
      ok: true,
      representative: { id: rep.id, doc: rep.doc ?? null },
      upserted: okCount,
      failed: failCount,
      removedRepresentativeItems,
      removedClientLinks,
      preservedClientLinks,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
