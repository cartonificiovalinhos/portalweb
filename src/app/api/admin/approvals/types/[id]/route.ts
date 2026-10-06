import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAdminApprovalAccess, isApprovalTypeNameValid, isMissingApprovalConfigTableError } from "@/lib/admin-approvals-auth";

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
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
    const name = normalizeText(body?.name);
    const description = normalizeText(body?.description) || null;
    const isActive = body?.isActive === undefined ? undefined : Boolean(body.isActive);

    if (!name) {
      return NextResponse.json({ error: "Nome do tipo é obrigatório." }, { status: 400 });
    }
    if (!isApprovalTypeNameValid(name)) {
      return NextResponse.json({ error: "Nome do tipo deve conter apenas letras e números, sem espaços ou caracteres especiais." }, { status: 400 });
    }

    const saved = await prisma.commercialFamilyApprovalType.update({
      where: { id: typeId },
      data: {
        name,
        description,
        ...(isActive === undefined ? {} : { isActive }),
      },
      include: {
        fields: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
        assignments: {
          orderBy: { id: "asc" },
          include: {
            approvalField: { select: { id: true, label: true, fieldType: true, useRange: true } },
            user: { select: { id: true, name: true, abbrevName: true, email: true, doc: true } },
          },
        },
      },
    });

    return NextResponse.json({ ok: true, type: saved });
  } catch (err: any) {
    if (isMissingApprovalConfigTableError(err)) {
      return NextResponse.json({ error: "Estrutura de aprovação ainda não existe no banco." }, { status: 500 });
    }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
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

    await prisma.commercialFamilyApprovalType.delete({
      where: { id: typeId },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isMissingApprovalConfigTableError(err)) {
      return NextResponse.json({ error: "Estrutura de aprovação ainda não existe no banco." }, { status: 500 });
    }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
