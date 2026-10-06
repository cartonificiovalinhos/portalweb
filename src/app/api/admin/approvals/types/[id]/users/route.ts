import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAdminApprovalAccess, isMissingApprovalConfigTableError } from "@/lib/admin-approvals-auth";

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeRangeValue(fieldType: string, value: unknown): { value: string | null; error?: string } {
  const raw = normalizeText(value);
  if (!raw) return { value: null };

  switch (fieldType) {
    case "INTEGER": {
      if (!/^-?\d+$/.test(raw)) return { value: null, error: "Faixa deve ser um número inteiro." };
      return { value: String(parseInt(raw, 10)) };
    }
    case "DECIMAL": {
      const numeric = Number(raw.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(numeric)) return { value: null, error: "Faixa deve ser um número decimal válido." };
      return { value: String(numeric) };
    }
    case "DATE": {
      const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return { value: null, error: "Faixa deve ser uma data válida." };
      const dt = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      if (
        dt.getFullYear() !== Number(match[1]) ||
        dt.getMonth() !== Number(match[2]) - 1 ||
        dt.getDate() !== Number(match[3])
      ) {
        return { value: null, error: "Faixa deve ser uma data válida." };
      }
      return { value: raw };
    }
    case "CHAR":
    default:
      return { value: raw };
  }
}

function compareRange(fieldType: string, fromValue: string | null, toValue: string | null): boolean {
  if (!fromValue || !toValue) return true;
  if (fieldType === "INTEGER" || fieldType === "DECIMAL") {
    return Number(fromValue) <= Number(toValue);
  }
  if (fieldType === "DATE") {
    return fromValue <= toValue;
  }
  return true;
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
    const assignmentId = Number(body?.assignmentId ?? 0);
    const userId = Number(body?.userId);
    const approvalFieldId = Number(body?.approvalFieldId);

    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: "Usuário inválido." }, { status: 400 });
    }

    if (!Number.isFinite(approvalFieldId) || approvalFieldId <= 0) {
      return NextResponse.json({ error: "Campo de faixa é obrigatório." }, { status: 400 });
    }

    const field = await prisma.commercialFamilyApprovalTypeField.findFirst({
      where: { id: approvalFieldId, approvalTypeId: typeId },
      select: { id: true, fieldType: true, label: true },
    });
    if (!field) {
      return NextResponse.json({ error: "Campo de faixa inválido para este tipo." }, { status: 400 });
    }

    const normalizedFrom = normalizeRangeValue(field.fieldType, body?.rangeFromValue);
    if (normalizedFrom.error) {
      return NextResponse.json({ error: normalizedFrom.error }, { status: 400 });
    }

    const normalizedTo = normalizeRangeValue(field.fieldType, body?.rangeToValue);
    if (normalizedTo.error) {
      return NextResponse.json({ error: normalizedTo.error }, { status: 400 });
    }

    if (!compareRange(field.fieldType, normalizedFrom.value, normalizedTo.value)) {
      return NextResponse.json({ error: "Faixa de/até inválida." }, { status: 400 });
    }

    const saved = assignmentId > 0
      ? await prisma.commercialFamilyApprovalTypeUser.update({
          where: { id: assignmentId },
          data: {
            approvalFieldId,
            userId,
            rangeFromValue: normalizedFrom.value,
            rangeToValue: normalizedTo.value,
          },
          include: {
            approvalField: { select: { id: true, label: true, fieldType: true } },
            user: { select: { id: true, name: true, abbrevName: true, email: true, doc: true } },
          },
        })
      : await prisma.commercialFamilyApprovalTypeUser.upsert({
          where: { approvalTypeId_approvalFieldId_userId: { approvalTypeId: typeId, approvalFieldId, userId } },
          update: {
            rangeFromValue: normalizedFrom.value,
            rangeToValue: normalizedTo.value,
          },
          create: {
            approvalTypeId: typeId,
            approvalFieldId,
            userId,
            rangeFromValue: normalizedFrom.value,
            rangeToValue: normalizedTo.value,
          },
          include: {
            approvalField: { select: { id: true, label: true, fieldType: true } },
            user: { select: { id: true, name: true, abbrevName: true, email: true, doc: true } },
          },
        });

    return NextResponse.json({ ok: true, assignment: saved });
  } catch (err: any) {
    if (isMissingApprovalConfigTableError(err)) {
      return NextResponse.json({ error: "Estrutura de aprovação ainda não existe no banco." }, { status: 500 });
    }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  await props.params;
  try {
    const access = await ensureAdminApprovalAccess();
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json().catch(() => ({} as any));
    const assignmentId = Number(body?.assignmentId);
    if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
      return NextResponse.json({ error: "assignmentId inválido." }, { status: 400 });
    }

    await prisma.commercialFamilyApprovalTypeUser.delete({
      where: { id: assignmentId },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isMissingApprovalConfigTableError(err)) {
      return NextResponse.json({ error: "Estrutura de aprovação ainda não existe no banco." }, { status: 500 });
    }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
