import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../lib/auth';

async function ensureClientPaymentTermColumn() {
  await prisma.$executeRawUnsafe('ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "paymentTermId" INTEGER');
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await ensureClientPaymentTermColumn();
    const session = await getServerSession(authOptions);
    const userId = session?.user ? Number((session.user as any).id) : null;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch user settings for integration mode
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { erpIntegrationMode: true }
    });
    const integrationRoute = user?.erpIntegrationMode === 'PROD' ? 'prd' : 'tst';

    const id = Number(params.id);
    
    // Fetch order with related data
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        entity: true,
        client: true,
        items: {
          include: {
            inventoryItem: true
          }
        }
      }
    });

    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // Extract Payment Terms Code (assuming format "[code] description")
    let paymentTermsErp = 30; // Default

    if (!order.paymentTerms) {
         return NextResponse.json({ error: 'Condição de Pagamento não informada. Por favor, selecione uma condição de pagamento.' }, { status: 400 });
    }

    if (order.paymentTerms) {
        const match = order.paymentTerms.match(/^\[(\d+)\]/);
        if (match && match[1]) {
            paymentTermsErp = parseInt(match[1], 10);
        } else {
            // Fallback: try to find by exact description in PaymentTerm table
            const term = await prisma.paymentTerm.findFirst({
                where: { description: { equals: order.paymentTerms.trim() } }
            });
            if (term?.code) {
                paymentTermsErp = term.code;
            }
        }
    }

    const customerDocRaw = order.client?.doc || order.customerDoc || '';

    let entityDoc = (order.entity?.cnpj || '').replace(/\D/g, '');
    if (!entityDoc && userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { lastEntityId: true }
        });
        if (user?.lastEntityId) {
             const entity = await prisma.entity.findUnique({ where: { id: user.lastEntityId } });
             if (entity) entityDoc = (entity.cnpj || '').replace(/\D/g, '');
        }
    }

    if (!customerDocRaw) return NextResponse.json({ error: 'CNPJ do cliente não encontrado.' }, { status: 400 });
    if (!entityDoc) return NextResponse.json({ error: 'Representante (Entidade) não identificado no pedido.' }, { status: 400 });

    // Construct Payload
    const payload = {
      route: integrationRoute,
      module: "mpd",
      version: "v1",
      resource: "simulaImpPedido",
      method: "POST",
      params: {
        order: {
          salesChannel: 1,
          paymentTermsErp: paymentTermsErp,
          branchId: "01",
          id: order.id,
          code: order.code,
          customerDoc: customerDocRaw.replace(/\D/g, ''),
          discountOrd: "0",
          deliveryDate: order.deliveryDate ? order.deliveryDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          observ: order.notes || "Simulação via Portal",
          entityDoc: entityDoc
        },
        orderitem: order.items.map(item => ({
          orderId: order.id,
          sku: item.sku || item.inventoryItem?.sku || "",
          quantity: item.quantity,
          diameter: item.diameter || 0,
          grammage: item.grammage || 0,
          tube: item.tube || 0,
          width: item.width || 0,
          length: item.length || 0,
          clientOrderNumber: item.clientOrderNumber || "",
          clientOrderItemNumber: item.clientOrderItemNumber || 0,
          deliveryDate: item.itemDeliveryDate ? item.itemDeliveryDate.toISOString().split('T')[0] : "",
          externalResin: item.externalResin ? "S" : "N",
          internalResin: item.internalResin ? "S" : "N"
        }))
      }
    };

    console.log('Simulate Tax Payload:', JSON.stringify(payload, null, 2));

    // Get ERP URL from settings
    const erpSetting = await prisma.systemSetting.findUnique({
      where: { key: 'erpUrl' }
    });
    const erpUrl = erpSetting?.value || 'http://cvserver13:8484';
    const apiUrl = erpUrl.endsWith('/') ? `${erpUrl}apiIntegrTotvsDts/` : `${erpUrl}/apiIntegrTotvsDts/`;

    // Call External API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const text = await response.text();
        console.error('External API Error:', text);
        return NextResponse.json({ 
            error: `Erro na API externa: ${response.status} - ${text}`,
            payloadSent: payload
        }, { status: response.status });
    }

    const data = await response.json();

    // Parse total with tax from response
    let totalWithTax = 0;
    if (data && data.vltotcomimp !== undefined) {
      totalWithTax = Number(data.vltotcomimp);
    }

    // Atualizar timestamp da última simulação e total com impostos
    await prisma.salesOrder.update({
      where: { id: order.id },
      data: { 
        lastTaxSimulation: new Date(),
        totalWithTax: totalWithTax
      }
    });

    return NextResponse.json(data);

  } catch (err: any) {
    console.error('Simulate Tax Error:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
