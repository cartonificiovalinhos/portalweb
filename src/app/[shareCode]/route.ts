import { prisma } from '../../lib/prisma';
import { renderSalesOrderPdf, salesOrderPdfFileName } from '../../lib/sales-order-pdf';
import {
  getSalesOrderIdFromPublicMirrorCode,
  isValidPublicMirrorCode,
  salesOrderMirrorInclude,
} from '../../lib/sales-order-share';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, props: { params: Promise<{ shareCode: string }> }) {
  try {
    const params = await props.params;
    const shareCode = String(params.shareCode || '').trim().toLowerCase();

    if (!isValidPublicMirrorCode(shareCode)) {
      return new Response('Link inválido', {
        status: 404,
        headers: { 'X-Robots-Tag': 'noindex, nofollow' },
      });
    }

    const orderId = getSalesOrderIdFromPublicMirrorCode(shareCode);
    if (!orderId) {
      return new Response('Link inválido', {
        status: 404,
        headers: { 'X-Robots-Tag': 'noindex, nofollow' },
      });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: salesOrderMirrorInclude,
    });
    if (!order) {
      return new Response('Link não encontrado', {
        status: 404,
        headers: { 'X-Robots-Tag': 'noindex, nofollow' },
      });
    }

    const pdf = await renderSalesOrderPdf(order);
    const fileName = salesOrderPdfFileName(order);

    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, no-store, no-cache, max-age=0',
        'Pragma': 'no-cache',
        'X-Robots-Tag': 'noindex, nofollow',
      }
    });
  } catch (err: any) {
    console.error('public mirror-pdf error', err);
    return new Response(String(err?.message || err || 'Erro ao gerar PDF'), {
      status: 500,
      headers: { 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
}
