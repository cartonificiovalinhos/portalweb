import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../lib/auth';
import { sendOrderStatusChangeNotification } from '../../../../../../lib/email';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
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

      // Parse optional resource from body
      let resource = "inserePedido";
      try {
        const body = await request.json();
        if (body && body.resource) {
          resource = body.resource;
        }
      } catch {
        // Body might be empty, ignore
      }

      // Construct Payload
      const payload = {
        route: integrationRoute,
        module: "mpd",
        version: "v1",
        resource: resource,
        method: "POST",
        params: {
          order: {
            salesChannel: 1,
            paymentTermsErp: paymentTermsErp,
            branchId: "01",
            id: order.id,
            code: order.code,
            customerDoc: customerDocRaw.replace(/\D/g, ''),
            triangularCustomerDoc: order.triangularCustomerDoc ? order.triangularCustomerDoc.replace(/\D/g, '') : "",
            discountOrd: "0",
            deliveryDate: order.deliveryDate ? order.deliveryDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            observ: order.notes || "Integração via Portal",
            entityDoc: entityDoc
          },
          orderitem: order.items.map(item => {
            const creases = item.creases as Record<string, number> | null;
            return {
              orderId: order.id,
              sku: item.sku || item.inventoryItem?.sku || "",
              quantity: item.quantity,
              discountPct: Number((item as any).discountPct ?? 0),
              diameter: item.diameter || 0,
              grammage: item.grammage || 0,
              tube: item.tube || 0,
              width: item.width || 0,
              length: item.length || 0,
              crease1: creases?.['1'] || 0,
              crease2: creases?.['2'] || 0,
              crease3: creases?.['3'] || 0,
              crease4: creases?.['4'] || 0,
              crease5: creases?.['5'] || 0,
              crease6: creases?.['6'] || 0,
              crease7: creases?.['7'] || 0,
              crease8: creases?.['8'] || 0,
              clientOrderNumber: item.clientOrderNumber || "",
              clientOrderItemNumber: item.clientOrderItemNumber || 0,
              deliveryDate: item.itemDeliveryDate ? item.itemDeliveryDate.toISOString().split('T')[0] : "",
              externalResin: item.externalResin ? "S" : "N",
              internalResin: item.internalResin ? "S" : "N"
            };
          })
        }
      };

      console.log('Integrate Order Payload:', JSON.stringify(payload, null, 2));

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
      console.log('Integration Result:', JSON.stringify(data, null, 2));

      // Analyze Response
      const messages: string[] = [];
      let hasError = false;
      let hasInfo = false;
      let erpOrderNumber: string | null = null;

      const translateErrorSubType = (v: any): string => {
        const s = String(v || '').trim().toUpperCase();
        if (s === 'ERROR') return 'ERRO';
        if (s === 'INFORMATION' || s === 'INFO') return 'INFORMAÇÃO';
        if (s === 'WARNING' || s === 'WARN') return 'AVISO';
        return s || '-';
      };

      const processItem = (item: any) => {
          if (item && typeof item === 'object') {
               if (item.ErrorNumber) {
                   erpOrderNumber = String(item.ErrorNumber);
               }

               if (item.ErrorSubType) {
                   const subTypeRaw = String(item.ErrorSubType || '').trim().toUpperCase();
                   const label = translateErrorSubType(item.ErrorSubType);
                   const msg = `${label}: ${item.ErrorDescription || ''}`;
                   messages.push(msg);
                   if (subTypeRaw === 'ERROR') hasError = true;
                   if (subTypeRaw === 'INFORMATION') hasInfo = true;
               }
          }
      };

      if (Array.isArray(data)) {
          data.forEach(processItem);
      } else if (data && typeof data === 'object') {
          processItem(data);
          if (Array.isArray(data.RowErrors)) {
              data.RowErrors.forEach(processItem);
          }
      }

      // Determine new status
      let newStatus = order.status;
      if (hasError) {
          newStatus = 'Erro na integração';
      } else if (hasInfo) {
          newStatus = 'Integrado';
      }

      // Update Order
      // Logic modified: If status changes, create new history. If status is same, update latest history.
      if (resource !== 'checkPedidoExiste') {
        if (newStatus !== order.status) {
            const updateData: any = {
                status: newStatus,
                statusHistory: {
                    create: {
                        status: newStatus,
                        messages: messages
                    }
                }
            };

            if (newStatus === 'Integrado' && erpOrderNumber) {
                updateData.erpOrderNumber = erpOrderNumber;
            }

            await prisma.salesOrder.update({
                where: { id: order.id },
                data: updateData
            });

            await sendOrderStatusChangeNotification({ orderId: order.id, status: newStatus });
        } else {
            // Status unchanged
            const lastHistory = await prisma.salesOrderStatusHistory.findFirst({
                where: { orderId: order.id },
                orderBy: { changedAt: 'desc' }
            });
    
            if (lastHistory) {
                // Update existing history record
                await prisma.salesOrderStatusHistory.update({
                    where: { id: lastHistory.id },
                    data: {
                        changedAt: new Date(),
                        messages: messages
                    }
                });
            } else {
                // No history exists (edge case), create one
                await prisma.salesOrderStatusHistory.create({
                    data: {
                        orderId: order.id,
                        status: newStatus,
                        messages: messages
                    }
                });
            }
        }
      }

      return NextResponse.json({ ...data, newStatus, messages });

    } catch (err: any) {
      console.error('Integration Error:', err);
      return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
    }
}
