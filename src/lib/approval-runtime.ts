import {
  APPROVAL_ORDER_STATUS,
  APPROVAL_PENDING_ROW_STATUS,
  formatApprovalDate,
  formatApprovalTime,
  getApprovalFieldDefinition,
  isApprovalValueInRange,
} from "@/lib/approval-documents";

type ApprovalEventInput = {
  moduleCode: string;
  entityName: string;
  actionName: string;
  entityKey: string | number;
  entityRecord: any;
  rootEntityName?: string;
  rootEntityKey?: string | number;
};

type PrismaLike = any;

function normalizeKey(value: string | number | null | undefined) {
  return String(value ?? "").trim();
}

function buildApprovalHistoryMessage(input: ApprovalEventInput, count: number) {
  const actionLabel =
    input.actionName === "CREATE" ? "Inclusao" :
    input.actionName === "UPDATE" ? "Alteracao" :
    input.actionName === "DELETE" ? "Exclusao" :
    input.actionName;

  return `APROVACAO AUTOMATICA: ${count} pendencia(s) criada(s) para ${input.entityName} na acao ${actionLabel}.`;
}

export async function triggerApprovalDocumentsForEvent(db: PrismaLike, input: ApprovalEventInput) {
  const entityKey = normalizeKey(input.entityKey);
  const rootEntityName = normalizeKey(input.rootEntityName || input.entityName);
  const rootEntityKey = normalizeKey(input.rootEntityKey || input.entityKey);
  if (!entityKey || !rootEntityName || !rootEntityKey) {
    return { triggered: false, pendingCount: 0, message: null as string | null };
  }

  const documents = await db.approvalDocument.findMany({
    where: {
      isActive: true,
      moduleCode: input.moduleCode,
      entityName: input.entityName,
      actionName: input.actionName,
    },
    include: {
      types: {
        where: { isActive: true },
        include: {
          assignments: {
            include: {
              approvalField: true,
              user: { select: { id: true } },
            },
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  if (!documents.length) {
    return { triggered: false, pendingCount: 0, message: null as string | null };
  }

  const now = new Date();
  const createdDate = formatApprovalDate(now);
  const createdTime = formatApprovalTime(now);
  let pendingCount = 0;

  for (const document of documents) {
    for (const approvalType of document.types || []) {
      for (const assignment of approvalType.assignments || []) {
        const approvalField = assignment.approvalField;
        if (!approvalField?.entityFieldKey) continue;

        const fieldDefinition = getApprovalFieldDefinition(input.entityName, approvalField.entityFieldKey);
        if (!fieldDefinition) continue;

        const fieldType = fieldDefinition.fieldType;
        const fieldValue = fieldDefinition.getValue(input.entityRecord);
        const matches = isApprovalValueInRange(fieldType, fieldValue, assignment.rangeFromValue, assignment.rangeToValue);
        if (!matches) continue;

        await db.approvalPending.upsert({
          where: {
            approvalDocumentId_approvalTypeId_approvalFieldId_userId_entityName_entityKey: {
              approvalDocumentId: document.id,
              approvalTypeId: approvalType.id,
              approvalFieldId: approvalField.id,
              userId: assignment.userId,
              entityName: input.entityName,
              entityKey,
            },
          },
          update: {
            rootEntityName,
            rootEntityKey,
            triggerAction: input.actionName,
            status: APPROVAL_PENDING_ROW_STATUS.PENDING,
            approvedAt: null,
            approvedDate: null,
            approvedTime: null,
            createdAt: now,
            createdDate,
            createdTime,
          },
          create: {
            approvalDocumentId: document.id,
            approvalTypeId: approvalType.id,
            approvalFieldId: approvalField.id,
            userId: assignment.userId,
            entityName: input.entityName,
            entityKey,
            rootEntityName,
            rootEntityKey,
            triggerAction: input.actionName,
            status: APPROVAL_PENDING_ROW_STATUS.PENDING,
            createdAt: now,
            createdDate,
            createdTime,
          },
        });

        pendingCount += 1;
      }
    }
  }

  return {
    triggered: pendingCount > 0,
    pendingCount,
    message: pendingCount > 0 ? buildApprovalHistoryMessage(input, pendingCount) : null,
  };
}

export async function markOrderAsPendingApproval(db: PrismaLike, orderId: number, message: string) {
  const order = await db.salesOrder.findUnique({
    where: { id: Math.trunc(orderId) },
    select: { id: true, status: true },
  });

  if (!order?.id) return false;

  const nextStatus = APPROVAL_ORDER_STATUS;
  await db.salesOrderStatusHistory.create({
    data: {
      orderId: Math.trunc(orderId),
      status: nextStatus,
      messages: [message],
    },
  });

  if (String(order.status || "").trim() !== nextStatus) {
    await db.salesOrder.update({
      where: { id: Math.trunc(orderId) },
      data: {
        status: nextStatus,
        erpOrderNumber: null,
      },
    });
  }

  return true;
}

export async function finalizeRootApprovalPendings(db: PrismaLike, rootEntityName: string, rootEntityKey: string | number, status: string) {
  const now = new Date();
  await db.approvalPending.updateMany({
    where: {
      rootEntityName,
      rootEntityKey: normalizeKey(rootEntityKey),
      status: APPROVAL_PENDING_ROW_STATUS.PENDING,
    },
    data: {
      status,
      approvedAt: now,
      approvedDate: formatApprovalDate(now),
      approvedTime: formatApprovalTime(now),
    },
  });
}

export async function countUserPendingApprovalsForOrders(db: PrismaLike, userId: number, orderIds: Array<number | string>) {
  const keys = Array.from(
    new Set(
      orderIds
        .map((value) => normalizeKey(value))
        .filter(Boolean),
    ),
  );

  if (!keys.length) return new Set<string>();

  const rows = await db.approvalPending.findMany({
    where: {
      userId: Math.trunc(userId),
      rootEntityName: "SALES_ORDER",
      rootEntityKey: { in: keys },
      status: APPROVAL_PENDING_ROW_STATUS.PENDING,
    },
    select: { rootEntityKey: true },
  });

  return new Set(rows.map((row: any) => normalizeKey(row.rootEntityKey)).filter(Boolean));
}
