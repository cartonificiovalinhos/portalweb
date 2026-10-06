import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAdminApprovalAccess, isMissingApprovalConfigTableError } from "@/lib/admin-approvals-auth";

const VALID_FIELD_TYPES = new Set(["INTEGER", "CHAR", "DATE", "DECIMAL"]);

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string; fieldId: string }> }) {
  const params = await props.params;
  try {
    const access = await ensureAdminApprovalAccess();
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const typeId = Number(params?.id);
    const fieldId = Number(params?.fieldId);
    if (!Number.isFinite(typeId) || typeId <= 0 || !Number.isFinite(fieldId) || fieldId <= 0) {
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

    const currentField = await prisma.commercialFamilyApprovalTypeField.findFirst({
      where: { id: fieldId, approvalTypeId: typeId },
      select: { id: true },
    });
    if (!currentField) {
      return NextResponse.json({ error: "Campo não encontrado para este tipo." }, { status: 404 });
    }

    const field = await prisma.commercialFamilyApprovalTypeField.update({
      where: { id: fieldId },
      data: { label, fieldType, required, useRange },
    });

    return NextResponse.json({ ok: true, field });
  } catch (err: any) {
    if (isMissingApprovalConfigTableError(err)) {
      return NextResponse.json({ error: "Estrutura de aprovação ainda não existe no banco." }, { status: 500 });
    }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string; fieldId: string }> }) {
  const params = await props.params;
  try {
    const access = await ensureAdminApprovalAccess();
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const fieldId = Number(params?.fieldId);
    if (!Number.isFinite(fieldId) || fieldId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    await prisma.commercialFamilyApprovalTypeField.delete({
      where: { id: fieldId },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isMissingApprovalConfigTableError(err)) {
      return NextResponse.json({ error: "Estrutura de aprovação ainda não existe no banco." }, { status: 500 });
    }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
