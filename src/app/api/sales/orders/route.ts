import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { validateOrderItemDimensionLimits } from '@/lib/order-item-dimension-limits';
import { attachResolvedCommercialFamilies } from '@/lib/commercial-family-dimension-resolution';

function normalizeDoc(doc: string): string {
  return (doc || '').replace(/\D+/g, '');
}

const SALES_ORDER_CODE_PREFIX = 'PV';
const SALES_ORDER_CODE_WIDTH = 6;

function formatSalesOrderCode(seq: number): string {
  if (!Number.isFinite(seq) || seq <= 0) throw new Error('Sequência inválida para número do pedido');
  if (seq > 10 ** SALES_ORDER_CODE_WIDTH - 1) throw new Error('Limite de numeração de pedido atingido');
  return `${SALES_ORDER_CODE_PREFIX}${String(seq).padStart(SALES_ORDER_CODE_WIDTH, '0')}`;
}

async function generateNextSalesOrderCode(db: any): Promise<string> {
  const last = await db.salesOrder.findFirst({
    where: { code: { startsWith: SALES_ORDER_CODE_PREFIX } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  const lastCode = typeof last?.code === 'string' ? last.code : '';
  const suffix = lastCode.startsWith(SALES_ORDER_CODE_PREFIX) ? lastCode.slice(SALES_ORDER_CODE_PREFIX.length) : '';
  const lastSeq = /^\d+$/.test(suffix) ? Number.parseInt(suffix, 10) : 0;
  return formatSalesOrderCode(lastSeq + 1);
}

function isUniqueSalesOrderCodeError(err: any): boolean {
  const code = err?.code;
  if (code === 'P2002') {
    const target = err?.meta?.target;
    if (Array.isArray(target)) return target.includes('code');
    if (typeof target === 'string') return target.includes('code');
    return true;
  }
  const msg = String(err?.message || err || '');
  return msg.toLowerCase().includes('duplicate') && msg.toLowerCase().includes('code');
}

async function resolveEntityIdFromDoc(raw: unknown): Promise<number | undefined> {
  const doc = typeof raw === 'string' ? normalizeDoc(raw) : '';
  if (!doc) return undefined;
  const direct = await prisma.entity.findFirst({ where: { cnpj: doc }, select: { id: true } }).catch(() => null);
  if (direct?.id) return Number(direct.id);
  const candidates = await prisma.entity.findMany({ select: { id: true, cnpj: true } }).catch(() => []);
  const match = (candidates || []).find((e: any) => normalizeDoc(String(e?.cnpj || '')) === doc);
  const id = match?.id;
  return id ? Number(id) : undefined;
}

function computeWeightKgFromFields(it: { width?: number | null; length?: number | null; grammage?: number | null; quantity?: number | null }): number {
  const w = Number(it.width ?? 0);
  const l = Number(it.length ?? 0);
  const g = Number(it.grammage ?? 0);
  const q = Number(it.quantity ?? 0);
  if (w > 0 && l > 0 && g > 0 && q > 0) {
    const areaM2 = (l / 1000) * (w / 1000);
    const weightKg = (areaM2 * g * q) / 1000;
    return weightKg;
  }
  return 0;
}

function lineBase(it: { quantity?: number | null; unitPrice?: number | null; unit?: string | null; width?: number | null; length?: number | null; grammage?: number | null }): number {
  const qty = Number(it.quantity ?? 0);
  const price = Number(it.unitPrice ?? 0);
  const unitPriceUnit = String(it.unit || '').trim().toUpperCase();
  if (unitPriceUnit === 'KG') return computeWeightKgFromFields(it) * price;
  return qty * price;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? Number((session.user as any).id) : null;
    if (!userId) return NextResponse.json([]);

    const url = new URL(request.url);
    const requestedDocRaw = url.searchParams.get('doc');
    const requestedDoc = requestedDocRaw ? normalizeDoc(requestedDocRaw) : undefined;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { salesRepAdmin: true, isSalesAdmin: true } });
    const hasLinks = Boolean(await prisma.userClientRep.findFirst({ where: { userId }, select: { id: true } }));
    const shouldRestrict = !Boolean(user?.isSalesAdmin) && (Boolean(user?.salesRepAdmin) || hasLinks);

    let where: any = requestedDoc ? { customerDoc: requestedDoc } : undefined;

    if (shouldRestrict) {
      const links = await prisma.userClientRep.findMany({
        where: { userId },
        select: { client: { select: { doc: true } } }
      });
      const allowedDocs = Array.from(
        new Set(
          links
            .map((l) => normalizeDoc(String(l.client?.doc || '')))
            .filter((d) => d.length > 0)
        )
      );

      if (allowedDocs.length === 0) return NextResponse.json([]);

      if (requestedDoc) {
        if (!allowedDocs.includes(requestedDoc)) return NextResponse.json([]);
        where = { customerDoc: requestedDoc };
      } else {
        where = { customerDoc: { in: allowedDocs } };
      }
    }

    const findOrdersWithAbbrev = async () => prisma.salesOrder.findMany({
      where,
      include: {
        entity: { select: { name: true } },
        createdBy: { select: { id: true, name: true, abbrevName: true } },
        items: {
          include: {
            inventoryItem: {
              include: { commercialFamily: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const findOrdersWithoutAbbrev = async () => prisma.salesOrder.findMany({
      where,
      include: {
        entity: { select: { name: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: {
            inventoryItem: {
              include: { commercialFamily: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    let data: any[] = [];
    try {
      data = await findOrdersWithAbbrev();
    } catch (err: any) {
      const msg = String(err?.message || err || '').toLowerCase();
      if (msg.includes('abbrevname') && (msg.includes('unknown column') || msg.includes('does not exist'))) {
        data = await findOrdersWithoutAbbrev();
      } else {
        throw err;
      }
    }

    const isCommercialApprovalStatus = (status: any): boolean => {
      const s = String(status || '').trim().toUpperCase();
      if (!s) return false;
      if (s === 'COMMERCIAL APPROVAL') return true;
      return s.includes('APROVA') && s.includes('COMERCIAL');
    };

    const rows = Array.isArray(data) ? data : [];
    const familyIdsSet = new Set<number>();
    for (const o of rows) {
      const items = Array.isArray((o as any)?.items) ? (o as any).items : [];
      for (const it of items) {
        const inv = (it as any)?.inventoryItem;
        const fidRaw = (inv as any)?.commercialFamilyId ?? (inv as any)?.commercialFamily?.id;
        const fid = Number(fidRaw);
        if (Number.isFinite(fid) && fid > 0) familyIdsSet.add(Math.trunc(fid));
      }
    }

    const eligibleFamilyIds = new Set<number>();
    if (familyIdsSet.size > 0) {
      const approvals = await prisma.commercialFamilyApprovalUser.findMany({
        where: { userId: Math.trunc(userId as number), commercialFamilyId: { in: Array.from(familyIdsSet) }, canView: true },
        select: { commercialFamilyId: true },
      });
      for (const a of approvals) {
        const fid = Number((a as any)?.commercialFamilyId);
        if (Number.isFinite(fid) && fid > 0) eligibleFamilyIds.add(Math.trunc(fid));
      }
    }

    for (const o of rows) {
      const inApproval = isCommercialApprovalStatus((o as any)?.status);
      let hasEligibleFamily = false;
      const items = Array.isArray((o as any)?.items) ? (o as any).items : [];
      for (const it of items) {
        const inv = (it as any)?.inventoryItem;
        const fidRaw = (inv as any)?.commercialFamilyId ?? (inv as any)?.commercialFamily?.id;
        const fid = Number(fidRaw);
        if (Number.isFinite(fid) && fid > 0 && eligibleFamilyIds.has(Math.trunc(fid))) {
          hasEligibleFamily = true;
          break;
        }
      }
      (o as any).canApproveCommercial = Boolean(inApproval && hasEligibleFamily);
    }

    return NextResponse.json(rows);
  } catch (err: any) {
    const message = err?.message || 'Erro ao listar pedidos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const session = await getServerSession(authOptions);
    const createdById = session?.user ? Number((session.user as any).id) : undefined;
    const {
      customerName,
      customerDoc,
      customerId,
      triangularCustomerName,
      triangularCustomerDoc,
      paymentTerms,
      carrier,
      deliveryDate,
      notes,
      items,
      entityCnpj,
      entityDoc,
    } = body || {};
    if (!customerName) {
      return NextResponse.json({ error: 'customerName é obrigatório' }, { status: 400 });
    }

    const customerDocNorm = typeof customerDoc === 'string' ? normalizeDoc(customerDoc) : undefined;
    const triangularCustomerDocNorm = typeof triangularCustomerDoc === 'string' ? normalizeDoc(triangularCustomerDoc) : undefined;

    let clientId: number | undefined = undefined;
    if (typeof customerId === 'number' && Number.isFinite(customerId) && customerId > 0) {
      clientId = Math.trunc(customerId);
    } else if (customerDocNorm) {
      const c = await prisma.client.findFirst({ where: { doc: customerDocNorm }, select: { id: true } }).catch(() => null);
      if (c?.id) clientId = Number(c.id);
    }
    const parseDate = (value: any): Date | undefined => {
      if (!value) return undefined;
      if (value instanceof Date && !isNaN(value.getTime())) return value;
      if (typeof value === 'string') {
        const v = value.trim();
        if (!v) return undefined;
        let y: number;
        let m: number;
        let d: number;
        const iso = /^(\d{4})-(\d{2})-(\d{2})/;
        const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        const ymd = /^(\d{4})(\d{2})(\d{2})$/;
        let mRes = v.match(iso);
        if (mRes) {
          y = Number(mRes[1]);
          m = Number(mRes[2]) - 1;
          d = Number(mRes[3]);
          const dt = new Date(y, m, d);
          return isNaN(dt.getTime()) ? undefined : dt;
        }
        mRes = v.match(dmy);
        if (mRes) {
          d = Number(mRes[1]);
          m = Number(mRes[2]) - 1;
          y = Number(mRes[3]);
          const dt = new Date(y, m, d);
          return isNaN(dt.getTime()) ? undefined : dt;
        }
        mRes = v.match(ymd);
        if (mRes) {
          y = Number(mRes[1]);
          m = Number(mRes[2]) - 1;
          d = Number(mRes[3]);
          const dt = new Date(y, m, d);
          return isNaN(dt.getTime()) ? undefined : dt;
        }
        const dt = new Date(v);
        return isNaN(dt.getTime()) ? undefined : dt;
      }
      return undefined;
    };
    let entityId: number | undefined;
    const rawCnpj = typeof entityCnpj === 'string' && entityCnpj.trim()
      ? entityCnpj
      : typeof entityDoc === 'string' && entityDoc.trim()
      ? entityDoc
      : undefined;
    if (rawCnpj) {
      const eid = await resolveEntityIdFromDoc(rawCnpj);
      if (eid) entityId = eid;
    }
    if (!entityId && createdById) {
      const u = await prisma.user.findUnique({ where: { id: createdById }, select: { lastEntityId: true } });
      if (u?.lastEntityId) entityId = u.lastEntityId;
    }
    const rawItems = Array.isArray(items) ? items : [];

    const normalizedItems = rawItems.map((it: any) => {
      const qty = Number(it.quantity || 1);
      const price = Number(it.unitPrice || 0);
      const disc = Number(it.discountPct || 0);
      const inventoryItemId = it.inventoryItemId ? Number(it.inventoryItemId) : undefined;
      const base = lineBase(
        {
          quantity: qty,
          unitPrice: price,
          unit: it.unit || undefined,
          width: it.width ? Number(it.width) : undefined,
          length: it.length ? Number(it.length) : undefined,
          grammage: it.grammage ? Number(it.grammage) : undefined,
        },
      );
      const lineTotal = base * (1 - disc / 100);
      return {
        inventoryItemId,
        sku: it.sku || undefined,
        name: String(it.name || it.productName || 'Produto'),
        quantity: qty,
        unit: it.unit || undefined,
        unitPrice: price,
        discountPct: disc,
        width: it.width ? Number(it.width) : undefined,
        length: it.length ? Number(it.length) : undefined,
        grammage: it.grammage ? Number(it.grammage) : undefined,
        diameter: it.diameter ? Number(it.diameter) : undefined,
        tube: it.tube ? Number(it.tube) : undefined,
        clientOrderNumber: it.clientOrderNumber || undefined,
        clientOrderItemNumber: it.clientOrderItemNumber ? Number(it.clientOrderItemNumber) : undefined,
        itemDeliveryDate: parseDate(it.itemDeliveryDate),
        internalResin: !!it.internalResin,
        externalResin: !!it.externalResin,
        creases: it.creases || undefined,
        lineTotal,
      };
    });

    const normalizedItemsWithFamily = normalizedItems.map((it: any) => ({
      ...it,
      inventoryItem: null as any,
    }));

    const invIdsForLimits = Array.from(
      new Set(
        normalizedItemsWithFamily
          .map((it: any) => Number(it.inventoryItemId))
          .filter((n: number) => Number.isFinite(n) && n > 0)
          .map((n: number) => Math.trunc(n))
      )
    );
    if (invIdsForLimits.length > 0) {
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: { id: { in: invIdsForLimits } },
        select: {
          id: true,
          commercialFamily: {
            select: {
              id: true,
              description: true,
              widthMin: true,
              widthMax: true,
              lengthMin: true,
              lengthMax: true,
            },
          },
        },
      });
      const familyByItemId = new Map<number, any>();
      for (const inv of inventoryItems) {
        familyByItemId.set(Number(inv.id), inv.commercialFamily ?? null);
      }
      for (const it of normalizedItemsWithFamily) {
        const invId = Number(it.inventoryItemId);
        if (Number.isFinite(invId) && invId > 0) {
          it.inventoryItem = { commercialFamily: familyByItemId.get(Math.trunc(invId)) ?? null };
        }
      }
    }

    const resolvedItemsWithFamily = await attachResolvedCommercialFamilies(prisma, normalizedItemsWithFamily);
    const dimensionInvalid = resolvedItemsWithFamily.find((it: any) => Boolean(validateOrderItemDimensionLimits(it)));
    if (dimensionInvalid) {
      return NextResponse.json(
        { error: validateOrderItemDimensionLimits(dimensionInvalid) || 'Dimensões do item inválidas.' },
        { status: 400 }
      );
    }

    if (clientId) {
      const invIds = Array.from(
        new Set(
          normalizedItems
            .map((i: any) => Number(i.inventoryItemId))
            .filter((n: number) => Number.isFinite(n) && n > 0)
            .map((n: number) => Math.trunc(n))
        )
      );
      if (invIds.length > 0) {
        const links = await prisma.clientItem.findMany({
          where: { clientId: Math.trunc(clientId), inventoryItemId: { in: invIds }, allowed: true },
          select: { inventoryItemId: true, unitPrice: true, manual: true },
        });
        const byInvId = new Map<number, { unitPrice: number; manual: boolean }>();
        for (const l of links) {
          byInvId.set(Math.trunc(Number(l.inventoryItemId)), { unitPrice: Number(l.unitPrice ?? 0), manual: Boolean(l.manual) });
        }

        const cents = (n: number) => Math.round(Number(n || 0) * 100);

        for (const it of normalizedItems) {
          const invId = it.inventoryItemId ? Math.trunc(Number(it.inventoryItemId)) : null;
          if (!invId) continue;
          const link = byInvId.get(invId);
          if (!link) continue;
          const reqCents = cents(it.unitPrice);
          const baseCents = cents(link.unitPrice);

          if (!link.manual) {
            if (reqCents !== baseCents) {
              return NextResponse.json(
                { error: `Preço não pode ser alterado para item não manual: ${String(it.sku || it.name || 'Item')}` },
                { status: 400 }
              );
            }
          } else {
            if (reqCents < baseCents) {
              return NextResponse.json(
                { error: `Preço não pode ser inferior ao valor carregado: ${String(it.sku || it.name || 'Item')}` },
                { status: 400 }
              );
            }
          }
        }
      }
    }

    const zeroPrice = normalizedItems.find((it: any) => Number(it.unitPrice ?? 0) <= 0);
    if (zeroPrice) {
      return NextResponse.json(
        { error: `Não é permitido salvar item com preço zero: ${String(zeroPrice.sku || zeroPrice.name || 'Item')}` },
        { status: 400 }
      );
    }
    const subtotal = normalizedItems.reduce((acc: number, i: any) => {
      return acc + lineBase(i);
    }, 0);
    const discountTotal = normalizedItems.reduce((acc: number, i: any) => {
      return acc + (lineBase(i) * (Number(i.discountPct || 0) / 100));
    }, 0);
    const total = subtotal - discountTotal;

    if (clientId) {
      await prisma
        .$executeRawUnsafe('DELETE FROM clientpaymentterm WHERE clientId = ? AND id IS NULL', Math.trunc(clientId))
        .catch(() => {});
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, paymentTermId: true }
      });

      const linkedCount = await prisma.clientPaymentTerm.count({ where: { clientId } });
      const hasLinkedTerms = linkedCount > 0;

      if (hasLinkedTerms && (!paymentTerms || !String(paymentTerms).trim())) {
        return NextResponse.json({ error: 'Condição de pagamento é obrigatória para este cliente' }, { status: 400 });
      }

      if (paymentTerms && String(paymentTerms).trim()) {
        const raw = String(paymentTerms).trim();
        const m = raw.match(/^\[(\d+)\]/);

        const resolved = m?.[1]
          ? await prisma.paymentTerm.findFirst({ where: { code: Number(m[1]) } })
          : await prisma.paymentTerm.findFirst({
              where: { description: { equals: raw } }
            });

        if (hasLinkedTerms) {
          if (!resolved) {
            return NextResponse.json({ error: 'Condição de pagamento inválida para este cliente' }, { status: 400 });
          }
          const allowedRows = await prisma
            .$queryRawUnsafe<any[]>(
              'SELECT id FROM clientpaymentterm WHERE clientId = ? AND paymentTermId = ? AND id IS NOT NULL LIMIT 1',
              Math.trunc(clientId),
              Math.trunc(resolved.id),
            )
            .catch(() => []);
          if (!allowedRows || allowedRows.length === 0) {
            return NextResponse.json({ error: 'Condição de pagamento não permitida para este cliente' }, { status: 400 });
          }
        } else if (client?.paymentTermId && resolved?.id && client.paymentTermId !== resolved.id) {
          return NextResponse.json({ error: 'Condição de pagamento não corresponde ao cadastro do cliente' }, { status: 400 });
        }
      }
    }

    const baseOrderCreateData = {
      entityId,
      customerName,
      customerDoc: customerDocNorm || undefined,
      clientId: clientId,
      triangularCustomerName: triangularCustomerName || undefined,
      triangularCustomerDoc: triangularCustomerDocNorm || undefined,
      paymentTerms: paymentTerms !== undefined && paymentTerms !== null ? String(paymentTerms) : undefined,
      carrier: carrier || undefined,
      deliveryDate: parseDate(deliveryDate),
      notes: notes || undefined,
      createdById: createdById,
      subtotal,
      discountTotal,
      total,
      items: { create: normalizedItems },
    } as const;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await generateNextSalesOrderCode(prisma);
      const orderCreateData = { ...baseOrderCreateData, code } as const;

      try {
        const created = await prisma.salesOrder.create({
          data: orderCreateData,
          include: { items: true },
        });
        return NextResponse.json(created, { status: 201 });
      } catch (e: any) {
        if (isUniqueSalesOrderCodeError(e)) continue;

        const msg = String(e?.message || e);
        if (!msg.includes('Could not figure out an ID in create')) throw e;

        try {
          const createdId = await prisma.$transaction(async (tx) => {
            const nextOrderIdRows = await tx.$queryRawUnsafe<any[]>('SELECT COALESCE(MAX(id), 0) + 1 as id FROM salesorder');
            const nextOrderId = nextOrderIdRows?.[0]?.id ? Number(nextOrderIdRows[0].id) : null;
            if (!nextOrderId || !Number.isFinite(nextOrderId) || nextOrderId <= 0) return null;

            await tx.$executeRawUnsafe(
              `INSERT INTO salesorder
                (id, code, entityId, customerName, customerDoc, clientId, triangularCustomerName, triangularCustomerDoc, paymentTerms, carrier, deliveryDate, notes, createdById, subtotal, discountTotal, total, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              Math.trunc(nextOrderId),
              code,
              entityId ?? null,
              customerName,
              customerDocNorm || null,
              clientId ?? null,
              triangularCustomerName || null,
              triangularCustomerDocNorm || null,
              paymentTerms !== undefined && paymentTerms !== null ? String(paymentTerms) : null,
              carrier || null,
              parseDate(deliveryDate) ?? null,
              notes || null,
              createdById ?? null,
              subtotal,
              discountTotal,
              total,
            );

            const id = Math.trunc(nextOrderId);

            const nextItemIdRows = await tx.$queryRawUnsafe<any[]>('SELECT COALESCE(MAX(id), 0) + 1 as id FROM salesorderitem');
            let nextItemId = nextItemIdRows?.[0]?.id ? Number(nextItemIdRows[0].id) : null;
            if (!nextItemId || !Number.isFinite(nextItemId) || nextItemId <= 0) return null;

            for (const it of normalizedItems as any[]) {
              const creasesJson = it.creases !== undefined ? JSON.stringify(it.creases) : null;
              await tx.$executeRawUnsafe(
                `INSERT INTO salesorderitem
                  (id, orderId, inventoryItemId, sku, name, quantity, unit, unitPrice, discountPct, lineTotal, width, length, grammage, diameter, tube, weightKg, creases, clientOrderNumber, clientOrderItemNumber, itemDeliveryDate, internalResin, externalResin)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                Math.trunc(nextItemId),
                Math.trunc(id),
                it.inventoryItemId ?? null,
                it.sku ?? null,
                it.name,
                Math.trunc(Number(it.quantity ?? 1)),
                it.unit ?? null,
                Number(it.unitPrice ?? 0),
                Number(it.discountPct ?? 0),
                Number(it.lineTotal ?? 0),
                it.width ?? null,
                it.length ?? null,
                it.grammage ?? null,
                it.diameter ?? null,
                it.tube ?? null,
                it.weightKg ?? null,
                creasesJson,
                it.clientOrderNumber ?? null,
                it.clientOrderItemNumber ?? null,
                it.itemDeliveryDate instanceof Date ? it.itemDeliveryDate : (it.itemDeliveryDate ? new Date(it.itemDeliveryDate) : null),
                it.internalResin ? 1 : 0,
                it.externalResin ? 1 : 0,
              );
              nextItemId += 1;
            }

            return Math.trunc(id);
          });

          if (!createdId || !Number.isFinite(createdId)) {
            return NextResponse.json({ error: 'Falha ao obter ID do pedido após criação (fallback)' }, { status: 500 });
          }

          return NextResponse.json({ id: createdId }, { status: 201 });
        } catch (fallbackErr: any) {
          if (isUniqueSalesOrderCodeError(fallbackErr)) continue;
          throw fallbackErr;
        }
      }
    }

    return NextResponse.json({ error: 'Falha ao gerar número do pedido' }, { status: 500 });
  } catch (err: any) {
    console.error('Create order error:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
