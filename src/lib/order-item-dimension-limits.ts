export type CommercialFamilyDimensionLimits = {
  description?: string | null;
  name?: string | null;
  widthMin?: number | null;
  widthMax?: number | null;
  lengthMin?: number | null;
  lengthMax?: number | null;
};

export type OrderItemWithDimensionLimits = {
  name?: string | null;
  sku?: string | null;
  quantity?: number | null;
  width?: number | null;
  length?: number | null;
  grammage?: number | null;
  inventoryItem?: {
    commercialFamily?: CommercialFamilyDimensionLimits | null;
  } | null;
};

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function familyLabel(family?: CommercialFamilyDimensionLimits | null): string {
  const label = String(family?.description || family?.name || '').trim();
  return label || 'família comercial';
}

function itemLabel(item: OrderItemWithDimensionLimits): string {
  return String(item.sku || item.name || 'item').trim();
}

function buildRequiredPositiveMessage(fieldLabel: string, item: OrderItemWithDimensionLimits): string {
  return `${fieldLabel} do item "${itemLabel(item)}" é obrigatório e deve ser maior que zero.`;
}

function requiresSheetDimensions(item: OrderItemWithDimensionLimits): boolean {
  const familyKey = inferCommercialFamilyKey(item);
  if (familyKey === 'CHAPAS') return true;

  return (
    item.width !== undefined ||
    item.length !== undefined ||
    item.grammage !== undefined
  );
}

export function inferCommercialFamilyKey(item: OrderItemWithDimensionLimits): string | null {
  const directFamily = normalizeText(item.inventoryItem?.commercialFamily?.description || item.inventoryItem?.commercialFamily?.name || '');
  if (directFamily) return directFamily;

  const text = normalizeText(`${item.name || ''} ${item.sku || ''}`);
  if (!text) return null;

  if (text.includes('CHAPA') || text.includes('CHAPAS')) return 'CHAPAS';
  if (text.includes('MIOLO')) return 'MIOLO';
  if (text.includes('PAPEL') && !text.includes('PAPELAO')) return 'PAPEL';
  return null;
}

function buildRangeMessage(fieldLabel: string, value: number, min: number | null, max: number | null, item: OrderItemWithDimensionLimits): string | null {
  if (min !== null && value < min) {
    return `${fieldLabel} do item "${itemLabel(item)}" deve ser maior ou igual a ${min}, conforme a família ${familyLabel(item.inventoryItem?.commercialFamily)}.`;
  }
  if (max !== null && value > max) {
    return `${fieldLabel} do item "${itemLabel(item)}" deve ser menor ou igual a ${max}, conforme a família ${familyLabel(item.inventoryItem?.commercialFamily)}.`;
  }
  return null;
}

export function validateOrderItemDimensionField(
  item: OrderItemWithDimensionLimits,
  field: 'width' | 'length',
  value: number | null | undefined,
): string | null {
  const family = item.inventoryItem?.commercialFamily;
  if (!family) return null;

  const numericValue = normalizeOptionalNumber(value);
  if (numericValue === null) return null;

  if (field === 'width') {
    return buildRangeMessage('Largura', numericValue, normalizeOptionalNumber(family.widthMin), normalizeOptionalNumber(family.widthMax), item);
  }

  return buildRangeMessage('Comprimento', numericValue, normalizeOptionalNumber(family.lengthMin), normalizeOptionalNumber(family.lengthMax), item);
}

export function validateOrderItemDimensionLimits(item: OrderItemWithDimensionLimits): string | null {
  const quantity = normalizeOptionalNumber(item.quantity);
  if (quantity === null || quantity <= 0) {
    return buildRequiredPositiveMessage('Quantidade', item);
  }

  if (requiresSheetDimensions(item)) {
    const width = normalizeOptionalNumber(item.width);
    if (width === null || width <= 0) {
      return buildRequiredPositiveMessage('Largura', item);
    }

    const length = normalizeOptionalNumber(item.length);
    if (length === null || length <= 0) {
      return buildRequiredPositiveMessage('Comprimento', item);
    }

    const grammage = normalizeOptionalNumber(item.grammage);
    if (grammage === null || grammage <= 0) {
      return buildRequiredPositiveMessage('Gramatura', item);
    }
  }

  const widthError = validateOrderItemDimensionField(item, 'width', item.width);
  if (widthError) return widthError;
  return validateOrderItemDimensionField(item, 'length', item.length);
}
