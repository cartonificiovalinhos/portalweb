import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApprovalFieldDefinition } from "@/lib/approval-documents";
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

    const currentField = await prisma.approvalDocumentTypeField.findFirst({
      where: { id: fieldId, approvalTypeId: typeId },
      select: {
        id: true,
        entityFieldKey: true,
        approvalType: {
          select: {
            approvalDocument: {
              select: {
                entityName: true,
              },
            },
          },
        },
      },
    });
    if (!currentField) {
      return NextResponse.json({ error: "Campo nao encontrado para este tipo." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({} as any));
    const required = body?.required === undefined ? true : Boolean(body.required);

    let label = normalizeText(body?.label);
    let fieldType = normalizeText(body?.fieldType).toUpperCase();
    let sourceType = normalizeText(body?.sourceType).toUpperCase() || "MANUAL";
    let entityFieldKey = normalizeText(body?.entityFieldKey) || currentField.entityFieldKey || null;

    if (currentField.approvalType?.approvalDocument?.entityName) {
      const definition = getApprovalFieldDefinition(currentField.approvalType.approvalDocument.entityName, entityFieldKey);
      if (!definition) {
        return NextResponse.json({ error: "Selecione um campo valido da entidade." }, { status: 400 });
      }
      label = definition.label;
      fieldType = definition.fieldType;
      sourceType = "ENTITY";
      entityFieldKey = definition.key;
    } else {
      if (!label) {
        return NextResponse.json({ error: "Nome do campo e obrigatorio." }, { status: 400 });
      }
      if (!VALID_FIELD_TYPES.has(fieldType)) {
        return NextResponse.json({ error: "Tipo de campo invalido." }, { status: 400 });
      }
      sourceType = "MANUAL";
      entityFieldKey = null;
    }

    const field = await prisma.approvalDocumentTypeField.update({
      where: { id: fieldId },
      data: { label, fieldType, required, sourceType, entityFieldKey },
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

    await prisma.approvalDocumentTypeField.delete({
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
