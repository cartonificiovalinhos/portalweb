import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../lib/auth';
import { sendOrderStatusChangeNotification } from '../../../../../../lib/email';

function isCommercialApprovalStatus(status: any): boolean {
  const s = String(status || '').trim().toUpperCase();
  if (!s) return false;
  if (s === 'COMMERCIAL APPROVAL') return true;
  return s.includes('APROVA') && s.includes('COMERCIAL');
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? Number((session.user as any).id) : null;
    const userName = String((session?.user as any)?.name || '').trim();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orderId = Number(params.id);
    if (!Number.isFinite(orderId) || orderId <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const body = await request.json().catch(() => ({} as any));
    const action = String(body?.action || '').trim().toLowerCase();
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id: Math.trunc(orderId) },
      select: {
        id: true,
        status: true,
        items: {
          select: {
            inventoryItem: {
              select: {
                commercialFamilyId: true,
                commercialFamily: { select: { id: true, description: true } },
              },
            },
          },
        },
      },
    });
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    if (!isCommercialApprovalStatus(order.status)) {
      return NextResponse.json({ error: 'Pedido não está em aprovação comercial' }, { status: 400 });
    }

    const familyIdsSet = new Set<number>();
    for (const it of order.items || []) {
      const inv: any = (it as any)?.inventoryItem;
      const fidRaw = inv?.commercialFamilyId ?? inv?.commercialFamily?.id;
      const fid = Number(fidRaw);
      if (Number.isFinite(fid) && fid > 0) familyIdsSet.add(Math.trunc(fid));
    }
    if (familyIdsSet.size === 0) {
      return NextResponse.json({ error: 'Pedido sem família comercial vinculada' }, { status: 400 });
    }

    const allowed = await prisma.commercialFamilyApprovalUser.findFirst({
      where: { userId: Math.trunc(userId), commercialFamilyId: { in: Array.from(familyIdsSet) }, canView: true },
      select: { id: true },
    });
    if (!allowed) return NextResponse.json({ error: 'Sem permissão para aprovar este pedido' }, { status: 403 });

    const historyStatus = 'Em Aprovação Comercial';
    const who = userName ? `${userName} (#${userId})` : `#${userId}`;
    const msg = action === 'approve'
      ? `APROVAÇÃO COMERCIAL: ${who} selecionou Aprovar`
      : `APROVAÇÃO COMERCIAL: ${who} selecionou Reprovar`;

    if (action === 'reject') {
      await prisma.$transaction(async (tx) => {
        await tx.salesOrderStatusHistory.create({
          data: {
            orderId: Math.trunc(orderId),
            status: historyStatus,
            messages: [msg],
          },
        });
        await tx.salesOrder.update({
          where: { id: Math.trunc(orderId) },
          data: { status: 'Reprovado', erpOrderNumber: null },
        });
      });
      await sendOrderStatusChangeNotification({ orderId: Math.trunc(orderId), status: 'Reprovado' });
      return NextResponse.json({ ok: true, status: 'Reprovado' });
    }

    await prisma.salesOrderStatusHistory.create({
      data: {
        orderId: Math.trunc(orderId),
        status: historyStatus,
        messages: [msg],
      },
    });

    const origin = new URL(request.url).origin;
    const cookie = request.headers.get('cookie') || '';
    const integrateRes = await fetch(`${origin}/api/sales/orders/${Math.trunc(orderId)}/integrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({}),
      cache: 'no-store',
    });
    const integrateJson = await integrateRes.json().catch(() => ({} as any));
    if (!integrateRes.ok) {
      return NextResponse.json({ error: integrateJson?.error || `Falha ao enviar para ERP (${integrateRes.status})` }, { status: integrateRes.status });
    }
    return NextResponse.json({ ok: true, integrated: true, result: integrateJson });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
