import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAdminApprovalAccess, isMissingApprovalConfigTableError } from "@/lib/admin-approvals-auth";
import {
  getApprovalTargetDefinition,
  listApprovalTargetDefinitions,
  normalizeApprovalErpId,
} from "@/lib/approval-documents";

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function generateTemporaryInternalCode() {
  return `TMP_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
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
        erpId: true,
        description: true,
        moduleCode: true,
        entityName: true,
        actionName: true,
        isActive: true,
      },
    });

    const [activeModules, activePrograms] = await Promise.all([
      prisma.module.findMany({
        where: { isActive: true },
        select: { code: true, name: true },
      }).catch(() => []),
      prisma.program.findMany({
        where: { isActive: true, module: { isActive: true } },
        select: {
          code: true,
          name: true,
          module: { select: { code: true, name: true } },
        },
      }).catch(() => []),
    ]);

    const targetOptions = {
      availableModules: activeModules,
      availablePrograms: activePrograms.map((program) => ({
        code: String(program.code || ""),
        name: String(program.name || ""),
        moduleCode: String(program.module?.code || ""),
        moduleName: String(program.module?.name || ""),
      })),
    };

    const targets = listApprovalTargetDefinitions(targetOptions).map((target) => ({
      ...target,
      label: `${target.moduleLabel} / ${target.entityLabel} / ${target.actions[0]?.actionLabel || ""}`,
    }));

    return NextResponse.json({
      documents: documents.map((document) => ({
        ...document,
        target: getApprovalTargetDefinition(document.moduleCode, document.entityName, document.actionName, targetOptions),
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
    const erpId = normalizeApprovalErpId(body?.erpId) || null;
    const description = normalizeText(body?.description);
    const moduleCode = normalizeText(body?.moduleCode) || null;
    const entityName = normalizeText(body?.entityName) || null;
    const actionName = normalizeText(body?.actionName) || null;
    const isActive = body?.isActive === undefined ? true : Boolean(body.isActive);

    if (!description) {
      return NextResponse.json({ error: "Descricao e obrigatoria." }, { status: 400 });
    }
    const [activeModules, activePrograms] = await Promise.all([
      prisma.module.findMany({
        where: { isActive: true },
        select: { code: true, name: true },
      }).catch(() => []),
      prisma.program.findMany({
        where: { isActive: true, module: { isActive: true } },
        select: {
          code: true,
          name: true,
          module: { select: { code: true, name: true } },
        },
      }).catch(() => []),
    ]);

    const targetOptions = {
      availableModules: activeModules,
      availablePrograms: activePrograms.map((program) => ({
        code: String(program.code || ""),
        name: String(program.name || ""),
        moduleCode: String(program.module?.code || ""),
        moduleName: String(program.module?.name || ""),
      })),
    };

    if ((moduleCode || entityName || actionName) && !getApprovalTargetDefinition(moduleCode, entityName, actionName, targetOptions)) {
      return NextResponse.json({ error: "Modulo, entidade e acao informados sao invalidos." }, { status: 400 });
    }

    const maxSort = await prisma.approvalDocument.aggregate({
      _max: { sortOrder: true },
    });

    const created = await prisma.$transaction(async (tx) => {
      const draft = await tx.approvalDocument.create({
        data: {
          internalCode: generateTemporaryInternalCode(),
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
        },
      });

      return tx.approvalDocument.update({
        where: { id: draft.id },
        data: {
          internalCode: String(draft.id),
        },
        select: {
          id: true,
          erpId: true,
          description: true,
          moduleCode: true,
          entityName: true,
          actionName: true,
          isActive: true,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      document: {
        ...created,
        target: getApprovalTargetDefinition(created.moduleCode, created.entityName, created.actionName, targetOptions),
      },
    });
  } catch (err: any) {
    if (isMissingApprovalConfigTableError(err)) {
      return NextResponse.json({ error: "Estrutura de aprovacao ainda nao existe no banco." }, { status: 500 });
    }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
