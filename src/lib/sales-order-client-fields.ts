export function normalizeOptionalText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const normalized = text.toLowerCase();
  if (normalized === 'null' || normalized === 'undefined') return null;
  return text;
}

export function resolveItemClientOrderNumber(
  itemClientOrderNumber: unknown,
  orderClientOrderNumber: unknown,
): string | null {
  return normalizeOptionalText(itemClientOrderNumber) ?? normalizeOptionalText(orderClientOrderNumber);
}
