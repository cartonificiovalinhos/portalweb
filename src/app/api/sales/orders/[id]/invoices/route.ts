import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const orderId = Number(params.id);
  if (isNaN(orderId)) return NextResponse.json([]);

  try {
    const invoices = await prisma.salesOrderInvoice.findMany({
      where: { orderId },
      orderBy: { issueDate: 'desc' }
    });
    return NextResponse.json(invoices);
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar faturas' }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const formData = await request.formData();
    const orderId = Number(params.id);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID do pedido inválido' }, { status: 400 });
    }

    const invoiceNumber = formData.get('invoiceNumber') as string;
    const issueDateStr = formData.get('issueDate') as string;
    const totalValueStr = formData.get('totalValue') as string;
    const totalWeightStr = formData.get('totalWeight') as string;
    
    const danfeFile = formData.get('danfeFile') as File | null;
    const xmlFile = formData.get('xmlFile') as File | null;

    if (!invoiceNumber || !issueDateStr || !totalValueStr) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando (invoiceNumber, issueDate, totalValue)' }, { status: 400 });
    }

    // Check if invoice exists to update or create
    // For simplicity, we'll check by invoiceNumber for this order
    const existing = await prisma.salesOrderInvoice.findFirst({
      where: { orderId, invoiceNumber }
    });

    // Directory for files: storage/sales-orders/[id]/billing/
    const uploadDir = path.join(process.cwd(), 'storage', 'sales-orders', String(orderId), 'billing');
    await mkdir(uploadDir, { recursive: true });

    let danfeFileName = existing?.danfeFileName || null;
    let xmlFileName = existing?.xmlFileName || null;

    if (danfeFile && danfeFile.size > 0) {
      const buffer = Buffer.from(await danfeFile.arrayBuffer());
      danfeFileName = `DANFE_${invoiceNumber}.pdf`; 
      await writeFile(path.join(uploadDir, danfeFileName), buffer);
    }

    if (xmlFile && xmlFile.size > 0) {
      const buffer = Buffer.from(await xmlFile.arrayBuffer());
      xmlFileName = `NFE_${invoiceNumber}.xml`;
      await writeFile(path.join(uploadDir, xmlFileName), buffer);
    }

    let invoice;
    if (existing) {
      invoice = await prisma.salesOrderInvoice.update({
        where: { id: existing.id },
        data: {
          issueDate: new Date(issueDateStr),
          totalValue: Number(totalValueStr),
          totalWeight: Number(totalWeightStr || 0),
          danfeFileName,
          xmlFileName
        }
      });
    } else {
      invoice = await prisma.salesOrderInvoice.create({
        data: {
          orderId,
          invoiceNumber,
          issueDate: new Date(issueDateStr),
          totalValue: Number(totalValueStr),
          totalWeight: Number(totalWeightStr || 0),
          danfeFileName,
          xmlFileName
        }
      });
    }

    return NextResponse.json(invoice);
  } catch (error: any) {
    console.error('Erro ao salvar fatura:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
