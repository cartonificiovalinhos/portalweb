import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clientIdParam = url.searchParams.get('clientId');
    const customerDocParam = url.searchParams.get('customerDoc');
    const customerNameParam = url.searchParams.get('customerName');
    const qParam = url.searchParams.get('q');
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
      
      let items = links.map(l => ({
        ...l.inventoryItem,
        unitPrice: l.unitPrice,
        priceUnit: l.unit
      }));
      
      if (qParam) {
        const lower = qParam.toLowerCase();
        items = items.filter(it => 
          it.name.toLowerCase().includes(lower) || 
          (it.sku && it.sku.toLowerCase().includes(lower))
        );
      }
      return NextResponse.json(items);
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
      return NextResponse.json(items);
    }

    const where: any = {};
    if (qParam) {
      where.OR = [
        { name: { contains: qParam } },
        { sku: { contains: qParam } }
      ];
    }
    const items = await prisma.inventoryItem.findMany({ 
      where,
      include: { commercialFamily: true } 
    });
    return NextResponse.json(items);
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
    const cfidNum = Number(body.commercialFamilyId);
    if (Number.isFinite(cfidNum) && cfidNum > 0) {
      const exists = await prisma.commercialFamily.findUnique({ where: { id: cfidNum } });
      data.commercialFamilyId = exists ? cfidNum : null;
    } else {
      data.commercialFamilyId = null;
    }
  }
  const created = await prisma.inventoryItem.create({ data });
  return NextResponse.json(created, { status: 201 });
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
