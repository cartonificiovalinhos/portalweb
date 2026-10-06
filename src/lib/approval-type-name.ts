export function sanitizeApprovalTypeName(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .trim();
}

export function isApprovalTypeNameValid(value: unknown): boolean {
  const raw = String(value || "").trim();
  return !!raw && raw === sanitizeApprovalTypeName(raw);
}
