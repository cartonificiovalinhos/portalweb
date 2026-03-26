import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? Number((session.user as any).id) : null;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { 
        customerDoc,
        paymentTerms,
        deliveryDate,
        items,
        notes
    } = body || {};

    if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'Itens são obrigatórios' }, { status: 400 });
    }

    // Fetch user settings for integration mode and entity
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { erpIntegrationMode: true, lastEntityId: true }
    });
    const integrationRoute = user?.erpIntegrationMode === 'PROD' ? 'prd' : 'tst';
    
    // Fetch Entity for entityDoc
    let entityDoc = '';
    if (user?.lastEntityId) {
        const entity = await prisma.entity.findUnique({
            where: { id: user.lastEntityId },
            select: { cnpj: true }
        });
        entityDoc = (entity?.cnpj || '').replace(/\D/g, '');
    }

    // Extract Payment Terms Code
    let paymentTermsErp = 30; // Default
    if (!paymentTerms) {
        return NextResponse.json({ error: 'Condição de Pagamento não informada. Por favor, selecione uma condição de pagamento.' }, { status: 400 });
    }
    if (paymentTerms) {
        const match = paymentTerms.match(/^\[(\d+)\]/);
        if (match && match[1]) {
            paymentTermsErp = parseInt(match[1], 10);
        } else {
             const term = await prisma.paymentTerm.findFirst({
                 where: { description: { equals: paymentTerms.trim() } }
             });
             if (term?.code) paymentTermsErp = term.code;
        }
    }

    const customerDocRaw = customerDoc || '';

    if (!customerDocRaw) return NextResponse.json({ error: 'CNPJ do cliente não encontrado.' }, { status: 400 });
    if (!entityDoc) return NextResponse.json({ error: 'Representante (Entidade) não identificado.' }, { status: 400 });

    // Construct Payload
    // Note: Since the order is not saved, we use 0 or dummy values for IDs
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
          id: 0, // No ID yet
          code: "SIMULACAO", // Dummy code
          customerDoc: customerDocRaw.replace(/\D/g, ''),
          discountOrd: "0",
          deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          observ: notes || "Simulação via Portal (Novo Pedido)",
          entityDoc: entityDoc
        },
        orderitem: items.map((item: any) => ({
          orderId: 0,
          sku: item.sku || item.inventoryItem?.sku || "",
          quantity: item.quantity,
          diameter: item.diameter || 0,
          grammage: item.grammage || 0,
          tube: item.tube || 0,
          width: item.width || 0,
          length: item.length || 0,
          clientOrderNumber: item.clientOrderNumber || "",
          clientOrderItemNumber: item.clientOrderItemNumber || 0,
          deliveryDate: item.itemDeliveryDate ? new Date(item.itemDeliveryDate).toISOString().split('T')[0] : "",
          externalResin: item.externalResin ? "S" : "N",
          internalResin: item.internalResin ? "S" : "N"
        }))
      }
    };

    console.log('Simulate Tax Payload (New Order):', JSON.stringify(payload, null, 2));

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
    return NextResponse.json(data);

  } catch (err: any) {
    console.error('Simulate Tax Error:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
