import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProgramAllowed } from "@/lib/isProgramAllowed";
import {
  APPROVAL_PENDING_ROW_STATUS,
  getApprovalFieldDefinition,
  getApprovalTargetDefinition,
} from "@/lib/approval-documents";

type PanelTab = "commercial" | "supplies" | "finance";
type PanelStatus = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

const TAB_MODULES: Record<PanelTab, string[]> = {
  commercial: ["SALES", "COMMERCIAL"],
  supplies: ["SUPPLIES", "SUPRIMENTOS", "PURCHASE", "PURCHASING"],
  finance: ["GESTAO_FINTI", "FINANCE", "FINANCIAL"],
};

function normalizeEntityId(session: any) {
  const raw = session?.entityId ?? session?.activeEntityId ?? null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
}

function normalizeTab(value: string | null): PanelTab {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "supplies") return "supplies";
  if (raw === "finance") return "finance";
  return "commercial";
}

function normalizeStatus(value: string | null): PanelStatus {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === APPROVAL_PENDING_ROW_STATUS.PENDING) return "PENDING";
  if (raw === APPROVAL_PENDING_ROW_STATUS.APPROVED) return "APPROVED";
  if (raw === APPROVAL_PENDING_ROW_STATUS.REJECTED) return "REJECTED";
  return "ALL";
}

function formatDateBr(value: string | null | undefined) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw || "-";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatStatusLabel(status: string | null | undefined) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === APPROVAL_PENDING_ROW_STATUS.PENDING) return "Pendente";
  if (normalized === APPROVAL_PENDING_ROW_STATUS.APPROVED) return "Aprovada";
  if (normalized === APPROVAL_PENDING_ROW_STATUS.REJECTED) return "Reprovada";
  return normalized || "-";
}

function formatValue(fieldType: string | null | undefined, value: unknown) {
  if (value == null || value === "") return "-";

  const normalizedType = String(fieldType || "").trim().toUpperCase();
  if (normalizedType === "DECIMAL") {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? numeric.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(value);
  }

  if (normalizedType === "INTEGER") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toLocaleString("pt-BR") : String(value);
  }

  if (normalizedType === "DATE") {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toLocaleDateString("pt-BR");
    }
    const raw = String(value).trim();
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) return raw;
  }

  return String(value);
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? Number((session.user as any).id) : null;
    const entityId = normalizeEntityId(session as any);

    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const allowed = await isProgramAllowed(userId, entityId, "PAINEL_APROVACAO_ELETRONICA");
    if (!allowed) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tab = normalizeTab(searchParams.get("tab"));
    const status = normalizeStatus(searchParams.get("status"));
    const moduleCodes = TAB_MODULES[tab];

    const rows = await prisma.approvalPending.findMany({
      where: {
        userId: Math.trunc(userId),
        ...(status === "ALL" ? {} : { status }),
        approvalDocument: moduleCodes.length > 0 ? { is: { moduleCode: { in: moduleCodes } } } : undefined,
      },
      include: {
        approvalDocument: {
          select: {
            id: true,
            description: true,
            erpId: true,
            moduleCode: true,
            entityName: true,
            actionName: true,
          },
        },
        approvalType: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        approvalField: {
          select: {
            id: true,
            label: true,
            fieldType: true,
            sourceType: true,
            entityFieldKey: true,
          },
        },
      },
    });

    const salesOrderRootIds = Array.from(
      new Set(
        rows
          .filter((row: any) => String(row.rootEntityName || "").trim() === "SALES_ORDER")
          .map((row: any) => Number(row.rootEntityKey))
          .filter((value: number) => Number.isFinite(value) && value > 0),
      ),
    );

    const salesOrderEntityIds = Array.from(
      new Set(
        rows
          .filter((row: any) => String(row.entityName || "").trim() === "SALES_ORDER")
          .map((row: any) => Number(row.entityKey))
          .filter((value: number) => Number.isFinite(value) && value > 0),
      ),
    );

    const salesOrderItemIds = Array.from(
      new Set(
        rows
          .filter((row: any) => String(row.entityName || "").trim() === "SALES_ORDER_ITEM")
          .map((row: any) => Number(row.entityKey))
          .filter((value: number) => Number.isFinite(value) && value > 0),
      ),
    );

    const [orders, orderEntities, items] = await Promise.all([
      salesOrderRootIds.length > 0
        ? prisma.salesOrder.findMany({
            where: { id: { in: salesOrderRootIds } },
            select: {
              id: true,
              code: true,
              customerName: true,
              customerDoc: true,
              clientOrderNumber: true,
              paymentTerms: true,
              carrier: true,
              status: true,
              erpOrderNumber: true,
              deliveryDate: true,
              subtotal: true,
              total: true,
              totalWithTax: true,
              totalInvoiced: true,
              discountTotal: true,
            },
          })
        : Promise.resolve([]),
      salesOrderEntityIds.length > 0
        ? prisma.salesOrder.findMany({
            where: { id: { in: salesOrderEntityIds } },
            select: {
              id: true,
              code: true,
              customerName: true,
              customerDoc: true,
              clientOrderNumber: true,
              paymentTerms: true,
              carrier: true,
              status: true,
              erpOrderNumber: true,
              deliveryDate: true,
              subtotal: true,
              total: true,
              totalWithTax: true,
              totalInvoiced: true,
              discountTotal: true,
            },
          })
        : Promise.resolve([]),
      salesOrderItemIds.length > 0
        ? prisma.salesOrderItem.findMany({
            where: { id: { in: salesOrderItemIds } },
            select: {
              id: true,
              orderId: true,
              sku: true,
              name: true,
              quantity: true,
              unit: true,
              unitPrice: true,
              discountPct: true,
              lineTotal: true,
              width: true,
              length: true,
              grammage: true,
              diameter: true,
              tube: true,
              weightKg: true,
              clientOrderNumber: true,
              clientItemCode: true,
              clientOrderItemNumber: true,
              itemDeliveryDate: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const orderById = new Map(orders.map((order: any) => [Number(order.id), order]));
    const orderEntityById = new Map(orderEntities.map((order: any) => [Number(order.id), order]));
    const itemById = new Map(items.map((item: any) => [Number(item.id), item]));

    const mapped = rows
      .map((row: any) => {
        const document = row.approvalDocument;
        const target = getApprovalTargetDefinition(document?.moduleCode, row.entityName, row.triggerAction);
        const rootOrder =
          String(row.rootEntityName || "").trim() === "SALES_ORDER"
            ? orderById.get(Number(row.rootEntityKey)) || null
            : null;
        const entityOrder =
          String(row.entityName || "").trim() === "SALES_ORDER"
            ? orderEntityById.get(Number(row.entityKey)) || null
            : null;
        const entityItem =
          String(row.entityName || "").trim() === "SALES_ORDER_ITEM"
            ? itemById.get(Number(row.entityKey)) || null
            : null;

        const fieldKey = String(row.approvalField?.entityFieldKey || "").trim();
        const fieldDefinition = fieldKey ? getApprovalFieldDefinition(row.entityName, fieldKey) : null;

        let entityRecord: any = null;
        if (String(row.entityName || "").trim() === "SALES_ORDER") {
          entityRecord = entityOrder;
        } else if (String(row.entityName || "").trim() === "SALES_ORDER_ITEM") {
          entityRecord = entityItem;
        }

        const rawMatchedValue = fieldDefinition && entityRecord ? fieldDefinition.getValue(entityRecord) : null;
        const activityDate = row.approvedAt || row.createdAt || null;

        return {
          id: Number(row.id),
          status: String(row.status || ""),
          statusLabel: formatStatusLabel(row.status),
          createdDate: String(row.createdDate || ""),
          createdTime: String(row.createdTime || ""),
          createdAtLabel: `${formatDateBr(row.createdDate)} ${String(row.createdTime || "").trim() || ""}`.trim(),
          approvedDate: row.approvedDate ? String(row.approvedDate) : null,
          approvedTime: row.approvedTime ? String(row.approvedTime) : null,
          approvedAtLabel: row.approvedDate
            ? `${formatDateBr(row.approvedDate)} ${String(row.approvedTime || "").trim() || ""}`.trim()
            : null,
          moduleCode: String(document?.moduleCode || ""),
          moduleLabel: target?.moduleLabel || String(document?.moduleCode || "-"),
          entityName: String(row.entityName || ""),
          entityLabel: target?.entityLabel || String(row.entityName || "-"),
          actionName: String(row.triggerAction || ""),
          actionLabel: target?.actionLabel || String(row.triggerAction || "-"),
          entityKey: String(row.entityKey || ""),
          rootEntityName: String(row.rootEntityName || ""),
          rootEntityKey: String(row.rootEntityKey || ""),
          canAct: String(row.status || "").trim().toUpperCase() === APPROVAL_PENDING_ROW_STATUS.PENDING
            && String(row.rootEntityName || "").trim() === "SALES_ORDER"
            && Number.isFinite(Number(row.rootEntityKey))
            && Number(row.rootEntityKey) > 0,
          document: {
            id: Number(document?.id || 0),
            description: String(document?.description || ""),
            erpId: document?.erpId ? String(document.erpId) : null,
          },
          type: {
            id: Number(row.approvalType?.id || 0),
            name: String(row.approvalType?.name || ""),
            description: row.approvalType?.description ? String(row.approvalType.description) : null,
          },
          field: {
            id: Number(row.approvalField?.id || 0),
            label: String(row.approvalField?.label || ""),
            fieldType: String(row.approvalField?.fieldType || ""),
            sourceType: String(row.approvalField?.sourceType || ""),
            entityFieldKey: row.approvalField?.entityFieldKey ? String(row.approvalField.entityFieldKey) : null,
            matchedValue: rawMatchedValue,
            matchedValueLabel: formatValue(row.approvalField?.fieldType, rawMatchedValue),
            rangeFromLabel: formatValue(row.approvalField?.fieldType, row.rangeFromValue),
            rangeToLabel: formatValue(row.approvalField?.fieldType, row.rangeToValue),
          },
          order: rootOrder
            ? {
                id: Number(rootOrder.id),
                code: String(rootOrder.code || ""),
                customerName: String(rootOrder.customerName || ""),
                status: String(rootOrder.status || ""),
                erpOrderNumber: rootOrder.erpOrderNumber ? String(rootOrder.erpOrderNumber) : null,
                deliveryDateLabel: formatValue("DATE", rootOrder.deliveryDate),
                totalLabel: formatValue("DECIMAL", rootOrder.total),
                discountTotalLabel: formatValue("DECIMAL", rootOrder.discountTotal),
              }
            : null,
          item: entityItem
            ? {
                id: Number(entityItem.id),
                sku: entityItem.sku ? String(entityItem.sku) : null,
                name: String(entityItem.name || ""),
                quantityLabel: formatValue("INTEGER", entityItem.quantity),
                unitPriceLabel: formatValue("DECIMAL", entityItem.unitPrice),
                discountPctLabel: formatValue("DECIMAL", entityItem.discountPct),
                lineTotalLabel: formatValue("DECIMAL", entityItem.lineTotal),
                deliveryDateLabel: formatValue("DATE", entityItem.itemDeliveryDate),
              }
            : null,
          activityAt: activityDate ? new Date(activityDate).getTime() : 0,
        };
      })
      .sort((a: any, b: any) => b.activityAt - a.activityAt);

    return NextResponse.json({
      items: mapped,
      meta: {
        tab,
        status,
        total: mapped.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
