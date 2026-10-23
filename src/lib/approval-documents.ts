export type ApprovalFieldType = "INTEGER" | "CHAR" | "DATE" | "DECIMAL";
export type ApprovalActionName = "CREATE" | "UPDATE" | "DELETE";
export type ApprovalEntityName = "SALES_ORDER" | "SALES_ORDER_ITEM";

export const APPROVAL_ORDER_STATUS = "Em Aprovação Comercial";
export const APPROVAL_PENDING_ROW_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

type ApprovalEntityFieldDefinition = {
  key: string;
  label: string;
  fieldType: ApprovalFieldType;
  getValue: (entity: any) => unknown;
};

type ApprovalTargetDefinition = {
  moduleCode: string;
  moduleLabel: string;
  entityName: ApprovalEntityName;
  entityLabel: string;
  actions: Array<{ actionName: ApprovalActionName; actionLabel: string }>;
};

const TARGET_DEFINITIONS: ApprovalTargetDefinition[] = [
  {
    moduleCode: "SALES",
    moduleLabel: "Vendas",
    entityName: "SALES_ORDER",
    entityLabel: "Entidade Pedido",
    actions: [
      { actionName: "CREATE", actionLabel: "Inclusao" },
      { actionName: "UPDATE", actionLabel: "Alteracao" },
      { actionName: "DELETE", actionLabel: "Exclusao" },
    ],
  },
  {
    moduleCode: "SALES",
    moduleLabel: "Vendas",
    entityName: "SALES_ORDER_ITEM",
    entityLabel: "Entidade Item Pedido",
    actions: [
      { actionName: "CREATE", actionLabel: "Inclusao" },
      { actionName: "UPDATE", actionLabel: "Alteracao" },
      { actionName: "DELETE", actionLabel: "Exclusao" },
    ],
  },
];

const ENTITY_FIELDS: Record<ApprovalEntityName, ApprovalEntityFieldDefinition[]> = {
  SALES_ORDER: [
    { key: "code", label: "Numero Pedido", fieldType: "CHAR", getValue: (entity) => entity?.code },
    { key: "customerName", label: "Cliente", fieldType: "CHAR", getValue: (entity) => entity?.customerName },
    { key: "customerDoc", label: "CPF/CNPJ Cliente", fieldType: "CHAR", getValue: (entity) => entity?.customerDoc },
    { key: "clientOrderNumber", label: "Pedido/OC Cliente", fieldType: "CHAR", getValue: (entity) => entity?.clientOrderNumber },
    { key: "paymentTerms", label: "Condicao Pagamento", fieldType: "CHAR", getValue: (entity) => entity?.paymentTerms },
    { key: "carrier", label: "Transportadora", fieldType: "CHAR", getValue: (entity) => entity?.carrier },
    { key: "deliveryDate", label: "Data Entrega", fieldType: "DATE", getValue: (entity) => entity?.deliveryDate },
    { key: "subtotal", label: "Subtotal", fieldType: "DECIMAL", getValue: (entity) => entity?.subtotal },
    { key: "discountTotal", label: "Desconto Total", fieldType: "DECIMAL", getValue: (entity) => entity?.discountTotal },
    { key: "total", label: "Total Pedido", fieldType: "DECIMAL", getValue: (entity) => entity?.total },
    { key: "totalWithTax", label: "Total com Imposto", fieldType: "DECIMAL", getValue: (entity) => entity?.totalWithTax },
    { key: "totalInvoiced", label: "Total Faturado", fieldType: "DECIMAL", getValue: (entity) => entity?.totalInvoiced },
    { key: "erpOrderNumber", label: "Pedido ERP", fieldType: "CHAR", getValue: (entity) => entity?.erpOrderNumber },
    { key: "status", label: "Situacao", fieldType: "CHAR", getValue: (entity) => entity?.status },
  ],
  SALES_ORDER_ITEM: [
    { key: "sku", label: "SKU", fieldType: "CHAR", getValue: (entity) => entity?.sku },
    { key: "name", label: "Descricao Item", fieldType: "CHAR", getValue: (entity) => entity?.name },
    { key: "quantity", label: "Quantidade", fieldType: "INTEGER", getValue: (entity) => entity?.quantity },
    { key: "unit", label: "Unidade", fieldType: "CHAR", getValue: (entity) => entity?.unit },
    { key: "unitPrice", label: "Preco Unitario", fieldType: "DECIMAL", getValue: (entity) => entity?.unitPrice },
    { key: "discountPct", label: "Desconto %", fieldType: "DECIMAL", getValue: (entity) => entity?.discountPct },
    { key: "lineTotal", label: "Total Item", fieldType: "DECIMAL", getValue: (entity) => entity?.lineTotal },
    { key: "width", label: "Largura", fieldType: "INTEGER", getValue: (entity) => entity?.width },
    { key: "length", label: "Comprimento", fieldType: "INTEGER", getValue: (entity) => entity?.length },
    { key: "grammage", label: "Gramatura", fieldType: "INTEGER", getValue: (entity) => entity?.grammage },
    { key: "diameter", label: "Diametro", fieldType: "INTEGER", getValue: (entity) => entity?.diameter },
    { key: "tube", label: "Tubete", fieldType: "INTEGER", getValue: (entity) => entity?.tube },
    { key: "weightKg", label: "Peso KG", fieldType: "INTEGER", getValue: (entity) => entity?.weightKg },
    { key: "clientOrderNumber", label: "Pedido Cliente", fieldType: "CHAR", getValue: (entity) => entity?.clientOrderNumber },
    { key: "clientItemCode", label: "Codigo Item Cliente", fieldType: "CHAR", getValue: (entity) => entity?.clientItemCode },
    { key: "clientOrderItemNumber", label: "Item Pedido Cliente", fieldType: "INTEGER", getValue: (entity) => entity?.clientOrderItemNumber },
    { key: "itemDeliveryDate", label: "Data Entrega Item", fieldType: "DATE", getValue: (entity) => entity?.itemDeliveryDate },
  ],
};

export function listApprovalTargetDefinitions() {
  return TARGET_DEFINITIONS.map((target) => ({
    ...target,
    fields: ENTITY_FIELDS[target.entityName].map((field) => ({
      key: field.key,
      label: field.label,
      fieldType: field.fieldType,
    })),
  }));
}

export function getApprovalEntityFields(entityName: string | null | undefined) {
  if (!entityName || !(entityName in ENTITY_FIELDS)) return [];
  return ENTITY_FIELDS[entityName as ApprovalEntityName];
}

export function getApprovalFieldDefinition(entityName: string | null | undefined, fieldKey: string | null | undefined) {
  const fields = getApprovalEntityFields(entityName);
  return fields.find((field) => field.key === fieldKey) || null;
}

export function getApprovalTargetDefinition(moduleCode: string | null | undefined, entityName: string | null | undefined, actionName: string | null | undefined) {
  const target = TARGET_DEFINITIONS.find((item) => item.moduleCode === moduleCode && item.entityName === entityName);
  if (!target) return null;
  const action = target.actions.find((item) => item.actionName === actionName);
  if (!action) return null;
  return {
    moduleCode: target.moduleCode,
    moduleLabel: target.moduleLabel,
    entityName: target.entityName,
    entityLabel: target.entityLabel,
    actionName: action.actionName,
    actionLabel: action.actionLabel,
  };
}

export function normalizeApprovalDocumentCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "");
}

export function normalizeApprovalErpId(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

export function formatApprovalDate(value: Date = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatApprovalTime(value: Date = new Date()) {
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const seconds = String(value.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function normalizeDateValue(value: unknown): string | null {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatApprovalDate(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const dmyMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return formatApprovalDate(date);
  }

  return null;
}

function normalizeDecimalValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).trim().replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(numeric)) return null;
  return String(numeric);
}

function normalizeIntegerValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).trim());
  if (!Number.isFinite(numeric)) return null;
  return String(Math.trunc(numeric));
}

function normalizeCharValue(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return raw ? raw.toUpperCase() : null;
}

export function normalizeComparableApprovalValue(fieldType: ApprovalFieldType, value: unknown): string | null {
  switch (fieldType) {
    case "DATE":
      return normalizeDateValue(value);
    case "DECIMAL":
      return normalizeDecimalValue(value);
    case "INTEGER":
      return normalizeIntegerValue(value);
    case "CHAR":
    default:
      return normalizeCharValue(value);
  }
}

export function isApprovalValueInRange(fieldType: ApprovalFieldType, rawValue: unknown, rawFrom: unknown, rawTo: unknown) {
  const value = normalizeComparableApprovalValue(fieldType, rawValue);
  if (!value) return false;

  const from = normalizeComparableApprovalValue(fieldType, rawFrom);
  const to = normalizeComparableApprovalValue(fieldType, rawTo);

  if (!from && !to) return true;

  if (fieldType === "DECIMAL" || fieldType === "INTEGER") {
    const numericValue = Number(value);
    const numericFrom = from == null ? null : Number(from);
    const numericTo = to == null ? null : Number(to);
    if (numericFrom != null && numericValue < numericFrom) return false;
    if (numericTo != null && numericValue > numericTo) return false;
    return true;
  }

  const compareValue = String(value);
  if (from != null && compareValue < from) return false;
  if (to != null && compareValue > to) return false;
  return true;
}
