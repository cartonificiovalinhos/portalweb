import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAdminApprovalAccess, isMissingApprovalConfigTableError } from "@/lib/admin-approvals-auth";

const VALID_FIELD_TYPES = new Set(["INTEGER", "CHAR", "DATE", "DECIMAL"]);

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const access = await ensureAdminApprovalAccess();
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const typeId = Number(params?.id);
    if (!Number.isFinite(typeId) || typeId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({} as any));
    const label = normalizeText(body?.label);
    const fieldType = normalizeText(body?.fieldType).toUpperCase();
    const required = body?.required === undefined ? true : Boolean(body.required);
    const useRange = body?.useRange === undefined ? false : Boolean(body.useRange);

    if (!label) {
      return NextResponse.json({ error: "Nome do campo é obrigatório." }, { status: 400 });
    }

    if (!VALID_FIELD_TYPES.has(fieldType)) {
      return NextResponse.json({ error: "Tipo de campo inválido." }, { status: 400 });
    }

    const maxSort = await prisma.commercialFamilyApprovalTypeField.aggregate({
      where: { approvalTypeId: typeId },
      _max: { sortOrder: true },
    });

    const field = await prisma.commercialFamilyApprovalTypeField.create({
      data: {
        approvalTypeId: typeId,
        label,
        fieldType,
        required,
        useRange,
        sortOrder: Number(maxSort._max.sortOrder ?? 0) + 1,
      },
    });

    return NextResponse.json({ ok: true, field });
  } catch (err: any) {
    if (isMissingApprovalConfigTableError(err)) {
      return NextResponse.json({ error: "Estrutura de aprovação ainda não existe no banco." }, { status: 500 });
    }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
