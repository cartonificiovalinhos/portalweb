import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAdminApprovalAccess, isMissingApprovalConfigTableError } from "@/lib/admin-approvals-auth";
import { getApprovalTargetDefinition, normalizeApprovalErpId } from "@/lib/approval-documents";

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const access = await ensureAdminApprovalAccess();
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const id = Number(params?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({} as any));
    const erpId = normalizeApprovalErpId(body?.erpId) || null;
    const description = normalizeText(body?.description);
    const moduleCode = normalizeText(body?.moduleCode) || null;
    const entityName = normalizeText(body?.entityName) || null;
    const actionName = normalizeText(body?.actionName) || null;
    const isActive = body?.isActive === undefined ? undefined : Boolean(body.isActive);

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

    if (!description) {
      return NextResponse.json({ error: "Descricao e obrigatoria." }, { status: 400 });
    }
    if ((moduleCode || entityName || actionName) && !getApprovalTargetDefinition(moduleCode, entityName, actionName, targetOptions)) {
      return NextResponse.json({ error: "Modulo, entidade e acao informados sao invalidos." }, { status: 400 });
    }

    const saved = await prisma.approvalDocument.update({
      where: { id: Math.trunc(id) },
      data: {
        erpId,
        description,
        moduleCode,
        entityName,
        actionName,
        ...(isActive === undefined ? {} : { isActive }),
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

    return NextResponse.json({
      ok: true,
      document: {
        ...saved,
        target: getApprovalTargetDefinition(saved.moduleCode, saved.entityName, saved.actionName, targetOptions),
      },
    });
  } catch (err: any) {
    if (isMissingApprovalConfigTableError(err)) {
      return NextResponse.json({ error: "Estrutura de aprovacao ainda nao existe no banco." }, { status: 500 });
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

    const id = Number(params?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    await prisma.approvalDocument.delete({
      where: { id: Math.trunc(id) },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isMissingApprovalConfigTableError(err)) {
      return NextResponse.json({ error: "Estrutura de aprovacao ainda nao existe no banco." }, { status: 500 });
    }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
