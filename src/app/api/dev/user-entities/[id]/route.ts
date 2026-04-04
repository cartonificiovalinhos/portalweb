import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

// GET /api/dev/user-entities/:id
// Lista as entidades vinculadas ao usuário informado (sem exigir sessão)
export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const uid = Number(params.id);
    if (!uid) return NextResponse.json({ ok: false, error: 'id de usuário inválido' }, { status: 400 });
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT e.id, e.cnpj, e.name, e."isActive"
      FROM "Entity" e
      JOIN "UserEntity" ue ON ue."entityId" = e.id
      WHERE ue."userId" = ${uid}
      ORDER BY e.name
    `);
    return NextResponse.json({ ok: true, userId: uid, entities: rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}