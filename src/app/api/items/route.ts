import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { attachResolvedCommercialFamilies } from '@/lib/commercial-family-dimension-resolution';
import { buildClientItemPriceFloorResolver } from '@/lib/client-item-price-floor';
import { toMySqlContainsPattern } from '@/lib/mysql-like';
import { resolveInventoryItemLookupSku, buildInventoryItemPatchData } from '@/lib/inventory-item-write';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clientIdParam = url.searchParams.get('clientId');
    const customerDocParam = url.searchParams.get('customerDoc');
    const customerNameParam = url.searchParams.get('customerName');
    const qParam = url.searchParams.get('q');
    const skuParam = String(url.searchParams.get('sku') || '').trim();
    const idsParam = url.searchParams.get('ids');

    let filterClientId: number | null = null;
    const filterIds: number[] = (idsParam || '')
      .split(',')
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (clientIdParam) {
      filterClientId = Number(clientIdParam);
    } else if (customerDocParam) {
      const doc = customerDocParam.replace(/\D/g, '');
      const client = await prisma.client.findFirst({ where: { doc } });
      if (client) {
        filterClientId = client.id;
      } else {
        // Se foi passado documento mas não achou cliente, retorna vazio para não trazer todos os itens
        return NextResponse.json([]);
      }
    } else if (customerNameParam) {
      const name = customerNameParam.trim();
      const client = await prisma.client.findFirst({ where: { name: { equals: name } } });
      if (client) {
        filterClientId = client.id;
      } else {
         return NextResponse.json([]);
      }
    }

    if (filterClientId) {
      const links = await prisma.clientItem.findMany({
        where: {
          clientId: filterClientId,
          allowed: true,
          ...(filterIds.length ? { inventoryItemId: { in: Array.from(new Set(filterIds)) } } : {}),
        },
        include: { 
          inventoryItem: {
            include: { commercialFamily: true }
          } 
        }
      });

      const resolvePriceFloor = await buildClientItemPriceFloorResolver(
        prisma,
        filterClientId,
        links.map((link) => Number(link.inventoryItemId)),
      );
      
      let items = links.map(l => {
        const pricing = resolvePriceFloor(l.inventoryItemId, l.unit ?? l.inventoryItem.unit);
        const effectiveUnitPrice = pricing.minAllowedPrice ?? Number(l.unitPrice ?? 0);
        return {
          ...l.inventoryItem,
          unitPrice: effectiveUnitPrice,
          minUnitPrice: pricing.minAllowedPrice,
          baseUnitPrice: pricing.basePrice,
          clientUnitPrice: Number(l.unitPrice ?? 0),
          priceUnit: l.unit,
          clientItemManual: l.manual
        };
      });
      
      if (skuParam) {
        const exactSku = skuParam.toLowerCase();
        items = items.filter((it) => String(it.sku || '').toLowerCase() === exactSku);
      }

      if (qParam) {
        const lower = qParam.toLowerCase();
        items = items.filter(it => 
          it.name.toLowerCase().includes(lower) || 
          (it.sku && it.sku.toLowerCase().includes(lower))
        );
      }
      return NextResponse.json(await attachResolvedCommercialFamilies(prisma, items));
    }

    const modsParam = url.searchParams.get('moduleIds');
    const selectedModuleIds = (modsParam || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (selectedModuleIds.length > 0) {
      const session = await getServerSession(authOptions);
      const activeEntityId: number | null = (session as any)?.activeEntityId ?? null;
      if (!activeEntityId) return NextResponse.json([]);

      const ems = await prisma.entityModule.findMany({
        where: { entityId: activeEntityId, moduleId: { in: selectedModuleIds } },
        select: { id: true },
      });
      const emIds = ems.map((e) => e.id);
      if (emIds.length === 0) return NextResponse.json([]);

      const links = await prisma.entityModuleItem.findMany({
        where: { entityModuleId: { in: emIds }, allowed: true },
        select: { inventoryItemId: true },
      });
      const itemIds = Array.from(new Set(links.map((l) => l.inventoryItemId)));
      if (itemIds.length === 0) return NextResponse.json([]);

      const items = await prisma.inventoryItem.findMany({
        where: { id: { in: itemIds } },
        include: { commercialFamily: true },
      });
      return NextResponse.json(await attachResolvedCommercialFamilies(prisma, items));
    }

    const where: any = {};
    if (skuParam) {
      where.sku = skuParam;
    }
    if (qParam) {
      const matchedRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id
           FROM inventoryitem
          WHERE name COLLATE utf8mb4_unicode_ci LIKE ?
             OR sku COLLATE utf8mb4_unicode_ci LIKE ?`,
        toMySqlContainsPattern(qParam),
        toMySqlContainsPattern(qParam),
      );
      const matchedIds = matchedRows
        .map((row) => Number(row.id))
        .filter((id) => Number.isFinite(id) && id > 0);
      if (matchedIds.length === 0) return NextResponse.json([]);
      where.id = { in: matchedIds };
    }
    const items = await prisma.inventoryItem.findMany({ 
      where,
      include: { commercialFamily: true } 
    });
    return NextResponse.json(await attachResolvedCommercialFamilies(prisma, items));
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const data: any = { name: String(body.name || '').trim() };
  if (body.sku !== undefined) data.sku = String(body.sku || '').trim();
  if (body.unit !== undefined) data.unit = String(body.unit || '').trim();
  if (body.quantity !== undefined) data.quantity = Number(body.quantity);
  if (body.minStock !== undefined) data.minStock = Number(body.minStock);
  if (body.width !== undefined) data.width = Number(body.width);
  if (body.length !== undefined) data.length = Number(body.length);
  if (body.grammage !== undefined) data.grammage = Number(body.grammage);
  if (body.commercialFamilyId !== undefined) {
    const patchData = await buildInventoryItemPatchData(prisma, { commercialFamilyId: body.commercialFamilyId });
    data.commercialFamilyId = patchData.commercialFamilyId ?? null;
  }
  const created = await prisma.inventoryItem.create({ data });
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const sku = await resolveInventoryItemLookupSku(body, request.url);
    if (!sku) return NextResponse.json({ error: 'SKU obrigatório' }, { status: 400 });

    const exists = await prisma.inventoryItem.findUnique({ where: { sku } });
    if (!exists) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });

    const data = await buildInventoryItemPatchData(prisma, body);
    const updated = await prisma.inventoryItem.update({ where: { sku }, data });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const ids: number[] = Array.isArray(body?.ids) ? body.ids.map((n: any) => Number(n)).filter((n) => Number.isFinite(n) && n > 0) : [];
    if (ids.length === 0) return NextResponse.json({ error: 'IDs obrigatórios' }, { status: 400 });
    await prisma.entityModuleItem.deleteMany({ where: { inventoryItemId: { in: ids } } });
    const result = await prisma.inventoryItem.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ deleted: result.count });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
