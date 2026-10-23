import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAdminApprovalAccess, isApprovalTypeNameValid, isMissingApprovalConfigTableError } from "@/lib/admin-approvals-auth";

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const access = await ensureAdminApprovalAccess();
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const documentId = Number(params?.id);
    if (!Number.isFinite(documentId) || documentId <= 0) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    const types = await prisma.approvalDocumentType.findMany({
      where: { approvalDocumentId: documentId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        fields: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
        assignments: {
          orderBy: [{ id: "asc" }],
          include: {
            approvalField: {
              select: { id: true, label: true, fieldType: true, sourceType: true, entityFieldKey: true },
            },
            user: {
              select: { id: true, name: true, abbrevName: true, email: true, doc: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ types });
  } catch (err: any) {
    if (isMissingApprovalConfigTableError(err)) {
      return NextResponse.json({ types: [], warning: "Estrutura de aprovacao ainda nao existe no banco." });
    }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const access = await ensureAdminApprovalAccess();
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const documentId = Number(params?.id);
    if (!Number.isFinite(documentId) || documentId <= 0) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({} as any));
    const name = normalizeText(body?.name);
    const description = normalizeText(body?.description) || null;
    const isActive = body?.isActive === undefined ? true : Boolean(body.isActive);

    if (!name) {
      return NextResponse.json({ error: "Nome do tipo e obrigatorio." }, { status: 400 });
    }
    if (!isApprovalTypeNameValid(name)) {
      return NextResponse.json({ error: "Nome do tipo deve conter apenas letras e numeros, sem espacos ou caracteres especiais." }, { status: 400 });
    }

    const maxSort = await prisma.approvalDocumentType.aggregate({
      where: { approvalDocumentId: documentId },
      _max: { sortOrder: true },
    });

    const created = await prisma.approvalDocumentType.create({
      data: {
        approvalDocumentId: documentId,
        name,
        description,
        isActive,
        sortOrder: Number(maxSort._max.sortOrder ?? 0) + 1,
      },
      include: {
        fields: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
        assignments: {
          orderBy: { id: "asc" },
          include: {
            approvalField: { select: { id: true, label: true, fieldType: true, sourceType: true, entityFieldKey: true } },
            user: { select: { id: true, name: true, abbrevName: true, email: true, doc: true } },
          },
        },
      },
    });

    return NextResponse.json({ ok: true, type: created });
  } catch (err: any) {
    if (isMissingApprovalConfigTableError(err)) {
      return NextResponse.json({ error: "Estrutura de aprovacao ainda nao existe no banco." }, { status: 500 });
    }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
