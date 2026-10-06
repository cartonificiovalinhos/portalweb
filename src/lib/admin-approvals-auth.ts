import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isProgramAllowed } from "@/lib/isProgramAllowed";
export { sanitizeApprovalTypeName, isApprovalTypeNameValid } from "@/lib/approval-type-name";

export async function ensureAdminApprovalAccess() {
  const session = await getServerSession(authOptions);
  const uid = session?.user ? Number((session.user as any).id) : undefined;
  const entityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;

  if (!uid) {
    return { ok: false as const, status: 401, error: "Não autenticado" };
  }

  const allowed = await isProgramAllowed(uid, entityId, "ADMIN_APPROVAL");
  if (!allowed) {
    return { ok: false as const, status: 403, error: "Sem permissão" };
  }

  return { ok: true as const, uid, entityId };
}

export function isMissingApprovalConfigTableError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || "").toLowerCase();
  return (
    msg.includes("commercialfamilyapprovaltype") ||
    msg.includes("commercialfamilyapprovaltypefield") ||
    msg.includes("commercialfamilyapprovaltypeuser")
  ) && (
    msg.includes("doesn't exist") ||
    msg.includes("does not exist") ||
    msg.includes("unknown table")
  );
}
