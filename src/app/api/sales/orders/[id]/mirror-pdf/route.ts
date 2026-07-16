import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../lib/auth';
import { prisma } from '../../../../../../lib/prisma';
import { renderSalesOrderPdf, salesOrderPdfFileName } from '../../../../../../lib/sales-order-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return new Response('Unauthorized', { status: 401 });

    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) return new Response('ID inválido', { status: 400 });

    const order = await prisma.salesOrder.findUnique({
      where: { id: Math.trunc(id) },
      include: {
        entity: true,
        client: true,
        items: {
          include: {
            inventoryItem: { include: { commercialFamily: true } }
          },
          orderBy: { id: 'asc' }
        }
      }
    });
    if (!order) return new Response('Pedido não encontrado', { status: 404 });

    const pdf = await renderSalesOrderPdf(order);
    const fileName = salesOrderPdfFileName(order);

    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      }
    });
  } catch (err: any) {
    console.error('mirror-pdf error', err);
    return new Response(String(err?.message || err || 'Erro ao gerar PDF'), { status: 500 });
  }
}
