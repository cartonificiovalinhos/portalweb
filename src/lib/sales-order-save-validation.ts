import { validateOrderItemDimensionLimits, type OrderItemWithDimensionLimits } from '@/lib/order-item-dimension-limits';

export type SalesOrderHeaderValidationInput = {
  customerName?: string | null;
  customerDoc?: string | null;
  customerId?: number | null;
  paymentTerms?: string | null;
  deliveryDate?: string | Date | null;
};

export type SalesOrderSaveItem = OrderItemWithDimensionLimits & {
  id?: number | null;
  unitPrice?: number | null;
  creases?: Record<string, number> | null;
};

export type SalesOrderSaveValidationInput = SalesOrderHeaderValidationInput & {
  items?: SalesOrderSaveItem[] | null;
};

function normalizeDoc(doc: string | null | undefined): string {
  return String(doc || '').replace(/\D+/g, '');
}

function parseDateInput(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const dt = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isFinite(dt.getTime()) ? dt : null;
  }

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const dt = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    if (
      dt.getFullYear() === Number(br[3]) &&
      dt.getMonth() === Number(br[2]) - 1 &&
      dt.getDate() === Number(br[1])
    ) {
      return dt;
    }
    return null;
  }

  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function validateSalesOrderHeaderRequiredFields(input: SalesOrderHeaderValidationInput): string | null {
  const customerName = String(input.customerName || '').trim();
  const paymentTerms = String(input.paymentTerms || '').trim();
  const customerId = Number(input.customerId ?? 0);
  const customerDoc = normalizeDoc(input.customerDoc);
  const deliveryDate = parseDateInput(input.deliveryDate);

  if (!customerName || (!(Number.isFinite(customerId) && customerId > 0) && !customerDoc)) {
    return 'Cliente é obrigatório.';
  }

  if (!paymentTerms) {
    return 'Condição de pagamento é obrigatória.';
  }

  if (!deliveryDate) {
    return 'Data de entrega é obrigatória.';
  }

  return null;
}

export function validateSalesOrderItemsForSave(items: SalesOrderSaveItem[] | null | undefined): string | null {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Adicione pelo menos um item ao pedido.';
  }

  for (let index = 0; index < items.length; index += 1) {
    const itemError = validateSalesOrderSingleItemForSave(items[index], index);
    if (itemError) return itemError;
  }

  return null;
}

export function validateSalesOrderSingleItemForSave(item: SalesOrderSaveItem, index = 0): string | null {
  const itemError = validateOrderItemDimensionLimits(item);
  if (itemError) return itemError;

  if (Number(item.unitPrice ?? 0) <= 0) {
    return `Não é permitido salvar item com preço zero: ${String(item.sku || item.name || `Item ${index + 1}`)}.`;
  }

  const width = Number(item.width ?? 0);
  if (width > 0) {
    const creases = item.creases || {};
    let creasesTotal = 0;
    for (let creaseIndex = 1; creaseIndex <= 8; creaseIndex += 1) {
      creasesTotal += Number(creases[String(creaseIndex)] ?? creases[creaseIndex] ?? 0);
    }
    if (creasesTotal > width) {
      return `A soma dos vincos está maior que a largura informada no item número ${index + 1}.`;
    }
  }

  return null;
}

export function validateSalesOrderForSave(input: SalesOrderSaveValidationInput): string | null {
  const headerError = validateSalesOrderHeaderRequiredFields(input);
  if (headerError) return headerError;

  return validateSalesOrderItemsForSave(input.items);
}
