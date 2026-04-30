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
      for (const it of cleaned) {
        const inventoryItemId = invBySku.get(it.itemCode);
        if (!inventoryItemId) {
          results.push({ itemCode: it.itemCode, unit: it.unit, success: false, error: 'SKU não encontrado no portal' });
          continue;
        }

        try {
          const row = await tx.userInventoryItemPrice.upsert({
            where: { userId_inventoryItemId_unit: { userId: repUserId, inventoryItemId, unit: it.unit } },
            update: { unitPrice: it.unitPrice },
            create: { userId: repUserId, inventoryItemId, unit: it.unit, unitPrice: it.unitPrice },
            select: { id: true, userId: true, inventoryItemId: true, unit: true, unitPrice: true },
          });
          results.push({ ...row, itemCode: it.itemCode, success: true });
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

