import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

// GET /api/dev/user-modules/:id
// Lista módulos vinculados ao usuário (por entidade), sem exigir sessão
export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const uid = Number(params.id);
    if (!uid) return NextResponse.json({ ok: false, error: 'id de usuário inválido' }, { status: 400 });

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT m.id as moduleId, m.code as moduleCode, m.name as moduleName,
             e.id as entityId, e.name as entityName,
             uem.allowed as allowed
      FROM "UserEntityModule" uem
      JOIN "UserEntity" ue ON ue.id = uem.userEntityId
      JOIN "Module" m ON m.id = uem.moduleId
      LEFT JOIN "Entity" e ON e.id = ue.entityId
      WHERE ue.userId = ${uid}
      ORDER BY e.name, m.name
    `);

    return NextResponse.json({ ok: true, userId: uid, modules: rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}