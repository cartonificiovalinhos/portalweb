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
    if (!session?.user) return new Response('Unauthorized', { status: 401 });

    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) return new Response('ID inválido', { status: 400 });

    const exists = await prisma.salesOrder.findUnique({
      where: { id: Math.trunc(id) },
      select: { id: true },
    });
    if (!exists) return new Response('Pedido não encontrado', { status: 404 });

    const publicCode = makeSalesOrderPublicMirrorCode(Math.trunc(id));
    const url = new URL(`/${publicCode}`, request.url);
    return Response.redirect(url, 302);
  } catch (err: any) {
    console.error('mirror-pdf error', err);
    return new Response(String(err?.message || err || 'Erro ao gerar PDF'), { status: 500 });
  }
}
