import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../lib/auth';
import { sendEmail } from '../../../../../../lib/email';
import { prisma } from '../../../../../../lib/prisma';
import { renderSalesOrderPdf, salesOrderPdfFileName } from '../../../../../../lib/sales-order-pdf';
import { makeSalesOrderPublicMirrorCode, salesOrderMirrorInclude } from '../../../../../../lib/sales-order-share';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return Response.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({} as any));
    const to = String(body?.to || '').trim().toLowerCase();
    if (!to || !isValidEmail(to)) {
      return Response.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id: Math.trunc(id) },
      include: salesOrderMirrorInclude,
    });
    if (!order) {
      return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    const pdf = await renderSalesOrderPdf(order);
    const fileName = salesOrderPdfFileName(order);
    const publicCode = makeSalesOrderPublicMirrorCode(Math.trunc(id));
    const publicUrl = new URL(`/${publicCode}`, request.url).toString();

    const subject = `Espelho do pedido ${order.code || order.id}`;
    const customerName = String(order.customerName || '').trim() || '-';
    const orderDate = order.orderDate ? new Date(order.orderDate).toLocaleDateString('pt-BR') : '-';
    const total = Number(order.totalWithTax ?? order.total ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    await sendEmail({
      to,
      subject,
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; color: #111827;">
          <p>Olá,</p>
          <p>Segue em anexo o espelho do pedido <strong>${order.code || order.id}</strong>.</p>
          <p>
            <strong>Cliente:</strong> ${customerName}<br />
            <strong>Data do pedido:</strong> ${orderDate}<br />
            <strong>Total:</strong> ${total}
          </p>
          <p>Se preferir, você também pode acessar o espelho por este link seguro:</p>
          <p><a href="${publicUrl}">${publicUrl}</a></p>
        </div>
      `,
      attachments: [
        {
          filename: fileName,
          content: Buffer.from(pdf),
          contentType: 'application/pdf',
        },
      ],
    });

    return Response.json({ ok: true, to, fileName, publicUrl });
  } catch (err: any) {
    return Response.json({ error: String(err?.message || err || 'Erro ao enviar espelho por e-mail') }, { status: 500 });
  }
}
