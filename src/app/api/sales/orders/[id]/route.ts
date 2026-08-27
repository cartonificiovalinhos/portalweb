import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { sendOrderStatusChangeNotification } from '../../../../../lib/email';
import { attachResolvedCommercialFamilies } from '@/lib/commercial-family-dimension-resolution';

function normalizeDoc(doc: string): string {
  return (doc || '').replace(/\D+/g, '');
}

function parsePositiveInt(raw: unknown): number | null {
  const s = String(raw ?? '').trim();
  const m = s.match(/^\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

async function resolveOrderKey(rawKey: string): Promise<{ id: number; customerDoc: string | null; clientId: number | null } | null> {
  const key = String(rawKey ?? '').trim();
  if (!key) return null;
  if (!/^[A-Za-z0-9-]+$/.test(key)) return null;

  const numeric = parsePositiveInt(key);
  if (numeric) {
    const byId = await prisma.salesOrder.findUnique({
      where: { id: numeric },
      select: { id: true, customerDoc: true, clientId: true },
    });
    if (byId) return byId;
  }

  const code = key.toUpperCase();
  if (code.length > 32) return null;
  const byCode = await prisma.salesOrder.findFirst({
    where: { code },
    select: { id: true, customerDoc: true, clientId: true },
  });
  return byCode;
}

async function shouldRestrictToLinkedClients(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { salesRepAdmin: true, isSalesAdmin: true } });
  if (user?.isSalesAdmin) return false;
  if (user?.salesRepAdmin) return true;
  const hasLinks = Boolean(await prisma.userClientRep.findFirst({ where: { userId }, select: { id: true } }));
  return hasLinks;
}

async function canAccessOrder(userId: number, order: { clientId?: number | null; customerDoc?: string | null }): Promise<boolean> {
  const clientId = order?.clientId != null ? Number(order.clientId) : null;
  if (clientId && Number.isFinite(clientId) && clientId > 0) {
    const byId = await prisma.userClientRep.findFirst({
      where: { userId, clientId: Math.trunc(clientId) },
      select: { id: true }
    });
    if (byId) return true;
  }

  const doc = normalizeDoc(String(order?.customerDoc || ''));
  if (!doc) return false;
  const link = await prisma.userClientRep.findFirst({
    where: { userId, client: { is: { doc } } },
    select: { id: true }
  });
  return Boolean(link);
}

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? Number((session.user as any).id) : null;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rawKey = String(params.id ?? '').trim();
    if (!rawKey) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const orderKey = await resolveOrderKey(rawKey);
    if (!orderKey) {
      if (!/^[A-Za-z0-9-]+$/.test(rawKey) || rawKey.length > 32) {
        return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }
    const id = Number(orderKey.id);

    if (await shouldRestrictToLinkedClients(userId)) {
      const ok = await canAccessOrder(userId, orderKey);
      if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        entity: true,
        items: {
          include: {
            inventoryItem: { include: { commercialFamily: true } }
          }
        }
      }
    });
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });

    let history: any[] = [];
    try {
      history = await prisma.salesOrderStatusHistory.findMany({
        where: { orderId: id },
        orderBy: { changedAt: 'desc' },
        select: { id: true, status: true, changedAt: true, messages: true },
      });
    } catch {
      const base = await prisma.salesOrderStatusHistory.findMany({
        where: { orderId: id },
        orderBy: { changedAt: 'desc' },
        select: { id: true, status: true, changedAt: true },
      });
      history = base.map((h) => ({ ...h, messages: [] }));
    }

    const clientId = order?.clientId != null ? Number((order as any).clientId) : null;
    if (clientId && Number.isFinite(clientId) && clientId > 0) {
      const itemRows: any[] = Array.isArray((order as any).items) ? (order as any).items : [];
      const resolvedItems = await attachResolvedCommercialFamilies(prisma, itemRows);
      (order as any).items = resolvedItems;
      const invIds = Array.from(
        new Set(
          resolvedItems
            .map((it) => Number(it?.inventoryItemId))
            .filter((n) => Number.isFinite(n) && n > 0)
            .map((n) => Math.trunc(n))
        )
      );
      if (invIds.length > 0) {
        const links = await prisma.clientItem.findMany({
          where: { clientId: Math.trunc(clientId), inventoryItemId: { in: invIds }, allowed: true },
          select: { inventoryItemId: true, unitPrice: true, manual: true },
        });
        const byInvId = new Map<number, { unitPrice: number; manual: boolean }>();
        for (const l of links) {
          byInvId.set(Math.trunc(Number(l.inventoryItemId)), { unitPrice: Number(l.unitPrice ?? 0), manual: Boolean(l.manual) });
        }
        for (const it of resolvedItems) {
          const invId = it?.inventoryItemId != null ? Math.trunc(Number(it.inventoryItemId)) : null;
          if (!invId) continue;
          const link = byInvId.get(invId);
          if (!link) continue;
          it.minUnitPrice = link.unitPrice;
          it.clientItemManual = link.manual;
          if (it.inventoryItem) {
            it.inventoryItem.clientItemManual = link.manual;
          }
        }
      }
    } else if (Array.isArray((order as any).items)) {
      (order as any).items = await attachResolvedCommercialFamilies(prisma, (order as any).items);
    }

    return NextResponse.json({ ...order, statusHistory: history });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? Number((session.user as any).id) : null;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = parsePositiveInt(params.id);
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const orderExists = await prisma.salesOrder.findUnique({ where: { id }, select: { id: true, status: true, customerDoc: true, clientId: true } });
    if (!orderExists) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });

    const previousStatus = String(orderExists.status ?? '').trim();

    if (await shouldRestrictToLinkedClients(userId)) {
      const ok = await canAccessOrder(userId, orderExists);
      if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const allowed: Record<string, any> = {};
    if (typeof body.status === 'string') {
      allowed.status = String(body.status);
      const s = allowed.status.trim().toUpperCase();
      if (s === 'OPEN' || s === 'ORÇAMENTO' || s === 'ORCAMENTO') {
        allowed.erpOrderNumber = null;
      }
    }
    if (typeof body.paymentTerms === 'string') {
      allowed.paymentTerms = String(body.paymentTerms);
    }
    if (typeof body.deliveryDate === 'string') {
      const v = body.deliveryDate.trim();
      allowed.deliveryDate = v ? new Date(v) : null;
    }
    if (typeof body.customerName === 'string') {
      allowed.customerName = String(body.customerName);
    }
    if (typeof body.customerDoc === 'string') {
      allowed.customerDoc = String(body.customerDoc);
    }
    if (typeof body.clientId === 'number') {
      allowed.clientId = Number.isFinite(body.clientId) ? Math.trunc(body.clientId) : null;
    }
    if (typeof body.triangularCustomerName === 'string') {
      allowed.triangularCustomerName = String(body.triangularCustomerName);
    }
    if (typeof body.triangularCustomerDoc === 'string') {
      allowed.triangularCustomerDoc = String(body.triangularCustomerDoc);
    }
    if (typeof body.totalInvoiced === 'number') {
      allowed.totalInvoiced = Number(body.totalInvoiced);
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    }

    const updated = await prisma.salesOrder.update({
      where: { id },
      data: allowed,
      include: { items: { include: { inventoryItem: { include: { commercialFamily: true } } } } },
    });

    if (allowed.status) {
      const messages: any[] = Array.isArray(body?.messages) ? body.messages : [];
      // Remove existing history for this status to avoid duplication if that's the intent
      // or simply add new history. The previous logic was DELETE then INSERT.
      // Replicating logic using Prisma Client:
      await prisma.salesOrderStatusHistory.deleteMany({
        where: { orderId: id, status: allowed.status }
      });
      
      await prisma.salesOrderStatusHistory.create({
        data: {
          orderId: id,
          status: allowed.status,
          messages: messages // Prisma handles Json type automatically
        }
      });

      const nextStatus = String(allowed.status ?? '').trim();
      if (nextStatus && nextStatus !== previousStatus) {
        await sendOrderStatusChangeNotification({ orderId: id, status: nextStatus });
      }
    }
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? Number((session.user as any).id) : null;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rawKey = String(params.id ?? '').trim();
    if (!rawKey) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const orderKey = await resolveOrderKey(rawKey);
    if (!orderKey) {
      if (!/^[A-Za-z0-9-]+$/.test(rawKey) || rawKey.length > 32) {
        return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }
    const id = Number(orderKey.id);

    if (await shouldRestrictToLinkedClients(userId)) {
      const ok = await canAccessOrder(userId, orderKey);
      if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.$transaction([
      prisma.salesOrderItem.deleteMany({ where: { orderId: id } }),
      prisma.salesOrderInvoice.deleteMany({ where: { orderId: id } }),
      prisma.salesOrderStatusHistory.deleteMany({ where: { orderId: id } }),
      prisma.salesOrder.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
