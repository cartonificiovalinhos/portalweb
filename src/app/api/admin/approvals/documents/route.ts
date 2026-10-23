import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAdminApprovalAccess, isMissingApprovalConfigTableError } from "@/lib/admin-approvals-auth";
import {
  getApprovalTargetDefinition,
  listApprovalTargetDefinitions,
  normalizeApprovalDocumentCode,
  normalizeApprovalErpId,
} from "@/lib/approval-documents";

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

export async function GET() {
  try {
    const access = await ensureAdminApprovalAccess();
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const documents = await prisma.approvalDocument.findMany({
      orderBy: [{ sortOrder: "asc" }, { description: "asc" }, { id: "asc" }],
      select: {
        id: true,
        internalCode: true,
        erpId: true,
        description: true,
        moduleCode: true,
        entityName: true,
        actionName: true,
        isActive: true,
      },
    });

    const activeModules = await prisma.module.findMany({
      where: { isActive: true },
      select: { code: true, name: true },
    }).catch(() => []);

    const moduleNameByCode = new Map(activeModules.map((item) => [String(item.code || "").toUpperCase(), String(item.name || "").trim()]));
    const targets = listApprovalTargetDefinitions().map((target) => ({
      ...target,
      moduleLabel: moduleNameByCode.get(String(target.moduleCode || "").toUpperCase()) || target.moduleLabel,
      label: `${moduleNameByCode.get(String(target.moduleCode || "").toUpperCase()) || target.moduleLabel} / ${target.entityLabel} / ${target.actions[0]?.actionLabel || ""}`,
    }));

    return NextResponse.json({
      documents: documents.map((document) => ({
        ...document,
        target: getApprovalTargetDefinition(document.moduleCode, document.entityName, document.actionName),
      })),
      targets,
    });
  } catch (err: any) {
    if (isMissingApprovalConfigTableError(err)) {
      return NextResponse.json({ documents: [], targets: listApprovalTargetDefinitions(), warning: "Estrutura de aprovacao ainda nao existe no banco." });
    }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await ensureAdminApprovalAccess();
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json().catch(() => ({} as any));
    const internalCode = normalizeApprovalDocumentCode(body?.internalCode);
    const erpId = normalizeApprovalErpId(body?.erpId) || null;
    const description = normalizeText(body?.description);
    const moduleCode = normalizeText(body?.moduleCode) || null;
    const entityName = normalizeText(body?.entityName) || null;
    const actionName = normalizeText(body?.actionName) || null;
    const isActive = body?.isActive === undefined ? true : Boolean(body.isActive);

    if (!internalCode) {
      return NextResponse.json({ error: "Codigo interno e obrigatorio." }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: "Descricao e obrigatoria." }, { status: 400 });
    }
    if ((moduleCode || entityName || actionName) && !getApprovalTargetDefinition(moduleCode, entityName, actionName)) {
      return NextResponse.json({ error: "Modulo, entidade e acao informados sao invalidos." }, { status: 400 });
    }

    const maxSort = await prisma.approvalDocument.aggregate({
      _max: { sortOrder: true },
    });

    const created = await prisma.approvalDocument.create({
      data: {
        internalCode,
        erpId,
        description,
        moduleCode,
        entityName,
        actionName,
        isActive,
        sortOrder: Number(maxSort._max.sortOrder ?? 0) + 1,
      },
      select: {
        id: true,
        internalCode: true,
        erpId: true,
        description: true,
        moduleCode: true,
        entityName: true,
        actionName: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      ok: true,
      document: {
        ...created,
        target: getApprovalTargetDefinition(created.moduleCode, created.entityName, created.actionName),
      },
    });
  } catch (err: any) {
    if (isMissingApprovalConfigTableError(err)) {
      return NextResponse.json({ error: "Estrutura de aprovacao ainda nao existe no banco." }, { status: 500 });
    }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
