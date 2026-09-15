export function normalizeOptionalText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

export function resolveItemClientOrderNumber(
  itemClientOrderNumber: unknown,
  orderClientOrderNumber: unknown,
): string | null {
  return normalizeOptionalText(itemClientOrderNumber) ?? normalizeOptionalText(orderClientOrderNumber);
}
