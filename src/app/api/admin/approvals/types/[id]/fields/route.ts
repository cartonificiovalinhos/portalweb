import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApprovalFieldDefinition } from "@/lib/approval-documents";
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

    const approvalType = await prisma.approvalDocumentType.findUnique({
      where: { id: typeId },
      select: {
        id: true,
        approvalDocument: {
          select: {
            entityName: true,
          },
        },
      },
    });
    if (!approvalType) {
      return NextResponse.json({ error: "Tipo de aprovacao nao encontrado." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({} as any));
    const required = body?.required === undefined ? true : Boolean(body.required);

    let label = normalizeText(body?.label);
    let fieldType = normalizeText(body?.fieldType).toUpperCase();
    let sourceType = normalizeText(body?.sourceType).toUpperCase() || "MANUAL";
    let entityFieldKey = normalizeText(body?.entityFieldKey) || null;

    if (approvalType.approvalDocument?.entityName) {
      const definition = getApprovalFieldDefinition(approvalType.approvalDocument.entityName, entityFieldKey);
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

    const maxSort = await prisma.approvalDocumentTypeField.aggregate({
      where: { approvalTypeId: typeId },
      _max: { sortOrder: true },
    });

    const field = await prisma.approvalDocumentTypeField.create({
      data: {
        approvalTypeId: typeId,
        label,
        fieldType,
        required,
        sourceType,
        entityFieldKey,
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
