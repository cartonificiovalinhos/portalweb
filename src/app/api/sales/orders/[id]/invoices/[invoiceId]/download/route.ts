import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../../../lib/prisma';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string, invoiceId: string }> }
) {
  const params = await props.params;
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const invoiceId = Number(params.invoiceId);
  const orderId = Number(params.id);

  if (isNaN(invoiceId) || isNaN(orderId)) {
    return new NextResponse('ID inválido', { status: 400 });
  }

  try {
    const invoice = await prisma.salesOrderInvoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice || invoice.orderId !== orderId) {
      return new NextResponse('Fatura não encontrada', { status: 404 });
    }

    let fileName: string | null = null;
    let contentType = 'application/octet-stream';

    if (type === 'danfe') {
      fileName = invoice.danfeFileName;
      contentType = 'application/pdf';
    } else if (type === 'xml') {
      fileName = invoice.xmlFileName;
      contentType = 'application/xml';
    } else {
      return new NextResponse('Tipo inválido (use ?type=danfe ou ?type=xml)', { status: 400 });
    }

    if (!fileName) {
      return new NextResponse('Arquivo não disponível para esta fatura', { status: 404 });
    }

    const filePath = path.join(process.cwd(), 'storage', 'sales-orders', String(orderId), 'billing', fileName);

    if (!existsSync(filePath)) {
       return new NextResponse('Arquivo físico não encontrado no servidor', { status: 404 });
    }

    const fileBuffer = await readFile(filePath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });

  } catch (error) {
    console.error('Erro ao baixar arquivo:', error);
    return new NextResponse('Erro interno ao baixar arquivo', { status: 500 });
  }
}
