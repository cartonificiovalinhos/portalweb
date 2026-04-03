import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';

const SALES_ORDER_CODE_PREFIX = 'PV';
const SALES_ORDER_CODE_WIDTH = 6;

function formatSalesOrderCode(seq: number): string {
  if (!Number.isFinite(seq) || seq <= 0) throw new Error('Sequência inválida para número do pedido');
  if (seq > 10 ** SALES_ORDER_CODE_WIDTH - 1) throw new Error('Limite de numeração de pedido atingido');
  return `${SALES_ORDER_CODE_PREFIX}${String(seq).padStart(SALES_ORDER_CODE_WIDTH, '0')}`;
}

async function generateNextSalesOrderCode(db: any): Promise<string> {
  const last = await db.salesOrder.findFirst({
    where: { code: { startsWith: SALES_ORDER_CODE_PREFIX } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  const lastCode = typeof last?.code === 'string' ? last.code : '';
  const suffix = lastCode.startsWith(SALES_ORDER_CODE_PREFIX) ? lastCode.slice(SALES_ORDER_CODE_PREFIX.length) : '';
  const lastSeq = /^\d+$/.test(suffix) ? Number.parseInt(suffix, 10) : 0;
  return formatSalesOrderCode(lastSeq + 1);
}

function isUniqueSalesOrderCodeError(err: any): boolean {
  const code = err?.code;
  if (code === 'P2002') {
    const target = err?.meta?.target;
    if (Array.isArray(target)) return target.includes('code');
    if (typeof target === 'string') return target.includes('code');
    return true;
  }
  const msg = String(err?.message || err || '');
  return msg.toLowerCase().includes('duplicate') && msg.toLowerCase().includes('code');
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const createdById = session?.user ? Number((session.user as any).id) : undefined;
    const entityId = (session as any).activeEntityId ? Number((session as any).activeEntityId) : undefined;
    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    // Get cart items
    const cartItems = await prisma.clientCartItem.findMany({
      where: { clientId },
      include: { inventoryItem: true }
    });

    if (cartItems.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // Get last order for payment terms
    const lastOrder = await prisma.salesOrder.findFirst({
      where: { customerDoc: client.doc || undefined },
      orderBy: { createdAt: 'desc' }
    });

    // Prepare items
    const normalizedItems = cartItems.map((it) => {
      const qty = it.quantity;
      const price = it.unitPrice;
      const disc = 0; 
      const lineTotal = qty * price;
      
      return {
        inventoryItemId: it.inventoryItemId,
        sku: it.inventoryItem.sku,
        name: it.inventoryItem.name,
        quantity: qty,
        unit: it.inventoryItem.unit,
        unitPrice: price,
        discountPct: disc,
        lineTotal,
        width: it.inventoryItem.width,
        length: it.inventoryItem.length,
        grammage: it.inventoryItem.grammage,
      };
    });

    const subtotal = normalizedItems.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
    const discountTotal = 0;
    const total = subtotal;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await generateNextSalesOrderCode(prisma);

      try {
        const result = await prisma.$transaction(async (tx) => {
          const order = await tx.salesOrder.create({
            data: {
              code,
              status: 'Orçamento',
              customerName: client.name,
              customerDoc: client.doc,
              clientId: client.id,
              entityId,
              paymentTerms: lastOrder?.paymentTerms,
              createdById,
              subtotal,
              discountTotal,
              total,
              items: { create: normalizedItems }
            }
          });

          await tx.clientCartItem.deleteMany({
            where: { clientId }
          });

          return order;
        });

        return NextResponse.json(result, { status: 201 });
      } catch (e: any) {
        if (isUniqueSalesOrderCodeError(e)) continue;
        throw e;
      }
    }

    return NextResponse.json({ error: 'Falha ao gerar número do pedido' }, { status: 500 });
  } catch (e: any) {
      console.error(e);
      return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
