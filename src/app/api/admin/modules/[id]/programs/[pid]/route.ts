import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../../lib/auth';
import { prisma } from '../../../../../../../lib/prisma';
import { isProgramAllowed } from '../../../../../../../lib/isProgramAllowed';

// DELETE /api/admin/modules/:id/programs/:pid
// Remove o programa indicado e todos os vínculos com entidades e usuários
export async function DELETE(_req: Request, props: { params: Promise<{ id: string; pid: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const entityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_MODULES');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const moduleId = Number(params.id);
    const programId = Number(params.pid);
    if (!moduleId || Number.isNaN(moduleId)) return NextResponse.json({ error: 'ID de módulo inválido' }, { status: 400 });
    if (!programId || Number.isNaN(programId)) return NextResponse.json({ error: 'ID de programa inválido' }, { status: 400 });

    const prog = await prisma.program.findUnique({ where: { id: programId }, select: { id: true, moduleId: true } });
    if (!prog) return NextResponse.json({ error: 'Programa não encontrado' }, { status: 404 });
    if (prog.moduleId !== moduleId) return NextResponse.json({ error: 'Programa não pertence ao módulo informado' }, { status: 400 });

    await prisma.$transaction([
      prisma.userEntityModuleProgram.deleteMany({ where: { programId } }),
      prisma.entityModuleProgram.deleteMany({ where: { programId } }),
      prisma.program.delete({ where: { id: programId } }),
    ]);

    return NextResponse.json({ ok: true, deletedId: programId });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PUT(request: Request, props: { params: Promise<{ id: string; pid: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const entityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_MODULES');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const moduleId = Number(params.id);
    const programId = Number(params.pid);
    if (!moduleId || Number.isNaN(moduleId)) return NextResponse.json({ error: 'ID de módulo inválido' }, { status: 400 });
    if (!programId || Number.isNaN(programId)) return NextResponse.json({ error: 'ID de programa inválido' }, { status: 400 });

    const body = await request.json();
    const name = typeof body.name === 'string' ? String(body.name).trim() : undefined;
    const description = body.description !== undefined ? (body.description ? String(body.description).trim() : null) : undefined;
    const showInMenu = body.showInMenu === undefined ? undefined : (body.showInMenu === true);
    if (name === undefined && description === undefined && showInMenu === undefined) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    const prog = await prisma.program.findUnique({ where: { id: programId }, select: { id: true, moduleId: true } });
    if (!prog) return NextResponse.json({ error: 'Programa não encontrado' }, { status: 404 });
    if (prog.moduleId !== moduleId) return NextResponse.json({ error: 'Programa não pertence ao módulo informado' }, { status: 400 });

    await prisma.program.update({
      where: { id: programId },
      data: {
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
        showInMenu: showInMenu !== undefined ? showInMenu : undefined,
      },
    });
    return NextResponse.json({ ok: true, id: programId });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
