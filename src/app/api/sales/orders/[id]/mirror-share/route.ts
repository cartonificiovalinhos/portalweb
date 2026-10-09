import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../lib/auth';
import { prisma } from '../../../../../../lib/prisma';
import { makeSalesOrderPublicMirrorCode } from '../../../../../../lib/sales-order-share';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return Response.json({ error: 'ID inválido' }, { status: 400 });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id: Math.trunc(id) },
      select: { id: true, code: true },
    });
    if (!order) {
      return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    const shareCode = makeSalesOrderPublicMirrorCode(Math.trunc(id));
    const url = new URL(`/${shareCode}`, request.url).toString();

    return Response.json({
      orderId: order.id,
      code: order.code,
      shareCode,
      url,
    });
  } catch (err: any) {
    return Response.json({ error: String(err?.message || err || 'Erro ao gerar link do espelho') }, { status: 500 });
  }
}
