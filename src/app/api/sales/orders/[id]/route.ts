import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';

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

async function shouldRestrictToLinkedClients(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { salesRepAdmin: true, isSalesAdmin: true } });
  if (user?.isSalesAdmin) return false;
  if (user?.salesRepAdmin) return true;
  const hasLinks = Boolean(await prisma.userClientRep.findFirst({ where: { userId }, select: { id: true } }));
  return hasLinks;
}

async function canAccessOrderByCustomerDoc(userId: number, customerDoc?: string | null): Promise<boolean> {
  const doc = normalizeDoc(String(customerDoc || ''));
  if (!doc) return false;
  const link = await prisma.userClientRep.findFirst({
    where: { userId, client: { is: { doc } } },
    select: { id: true }
  });
  return Boolean(link);
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? Number((session.user as any).id) : null;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rawKey = String(params.id ?? '').trim();
    if (!rawKey) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    let id = parsePositiveInt(rawKey);
    let orderExists = id
      ? await prisma.salesOrder.findUnique({ where: { id }, select: { id: true, customerDoc: true } })
      : null;

    if (!orderExists) {
      const code = rawKey.toUpperCase();
      const looksLikeCode = /^[A-Z]{1,10}\d{2,}$/.test(code);
      if (!looksLikeCode) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

      orderExists = await prisma.salesOrder.findFirst({ where: { code }, select: { id: true, customerDoc: true } });
      if (orderExists?.id) id = Number(orderExists.id);
    }

    if (!orderExists || !id) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });

    if (await shouldRestrictToLinkedClients(userId)) {
      const ok = await canAccessOrderByCustomerDoc(userId, orderExists.customerDoc);
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

    return NextResponse.json({ ...order, statusHistory: history });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? Number((session.user as any).id) : null;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = parsePositiveInt(params.id);
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const orderExists = await prisma.salesOrder.findUnique({ where: { id }, select: { id: true, customerDoc: true } });
    if (!orderExists) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });

    if (await shouldRestrictToLinkedClients(userId)) {
      const ok = await canAccessOrderByCustomerDoc(userId, orderExists.customerDoc);
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
    }
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? Number((session.user as any).id) : null;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = parsePositiveInt(params.id);
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const orderExists = await prisma.salesOrder.findUnique({ where: { id }, select: { id: true, customerDoc: true } });
    if (!orderExists) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });

    if (await shouldRestrictToLinkedClients(userId)) {
      const ok = await canAccessOrderByCustomerDoc(userId, orderExists.customerDoc);
      if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.salesOrder.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
