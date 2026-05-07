import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { isProgramAllowed } from '../../../../../lib/isProgramAllowed';

function escapeLike(v: string): string {
  return String(v || '').replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const entityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_APPROVAL');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return NextResponse.json({ users: [] });

    const like = `%${escapeLike(q)}%`;
    const docDigits = q.replace(/\D+/g, '');
    const docLike = `%${escapeLike(docDigits)}%`;

    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, name, abbrevName, email, doc
      FROM \`user\`
      WHERE
        name COLLATE utf8mb4_general_ci LIKE ${like} ESCAPE '\\'
        OR IFNULL(abbrevName, '') COLLATE utf8mb4_general_ci LIKE ${like} ESCAPE '\\'
        OR IFNULL(email, '') COLLATE utf8mb4_general_ci LIKE ${like} ESCAPE '\\'
        OR (${docDigits} <> '' AND IFNULL(doc, '') LIKE ${docLike} ESCAPE '\\')
      ORDER BY name ASC
      LIMIT 50
    `;

    return NextResponse.json({ users: rows });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
