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

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
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
      const repClients = await tx.userClientRep.findMany({
        where: { userId: repUserId },
        select: { clientId: true },
      });
      const repClientIds = Array.from(
        new Set(repClients.map((x) => Number(x.clientId)).filter((x) => Number.isFinite(x) && x > 0))
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
          });
          const previousMatches = previousRows.filter((r) => normalizeUnit(r.unit) === it.unit);
          const previousPreferred =
            previousMatches.find((r) => String(r.unit || '').trim().toUpperCase() === it.unit) ?? previousMatches[0] ?? null;
          const oldBasePrice = Number(previousPreferred?.unitPrice ?? 0);
          const newBasePrice = Number(it.unitPrice ?? 0);

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
          if (repClientIds.length > 0 && oldBasePrice > 0 && newBasePrice > 0) {
            const clientLinks = await tx.clientItem.findMany({
              where: {
                clientId: { in: repClientIds },
                inventoryItemId,
                allowed: true,
                unitPrice: { gt: 0 },
              },
              select: { id: true, unitPrice: true, unit: true, inventoryItem: { select: { unit: true } } },
            });

            for (const cl of clientLinks) {
              const clUnit = normalizeUnit(cl.unit ?? cl.inventoryItem?.unit);
              if (!clUnit || clUnit !== it.unit) continue;
              const currentClientPrice = Number(cl.unitPrice ?? 0);
              if (!Number.isFinite(currentClientPrice) || currentClientPrice <= 0) continue;
              const ratio = currentClientPrice / oldBasePrice;
              if (!Number.isFinite(ratio) || ratio <= 0) continue;
              const updatedClientPrice = newBasePrice * ratio;
              if (!Number.isFinite(updatedClientPrice) || updatedClientPrice <= 0) continue;
              await tx.clientItem.update({
                where: { id: cl.id },
                data: { unitPrice: updatedClientPrice },
              });
              adjustedClients += 1;
            }
          }

          results.push({ ...row, itemCode: it.itemCode, success: true });
          if (adjustedClients > 0) {
            (results[results.length - 1] as any).adjustedClients = adjustedClients;
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
