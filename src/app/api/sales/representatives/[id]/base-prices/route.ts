import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { toMySqlContainsPattern } from '@/lib/mysql-like';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const repUserId = Number(params.id);
    if (!Number.isFinite(repUserId) || repUserId <= 0) return NextResponse.json([]);

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    const takeRaw = Number(url.searchParams.get('take') || 1000);
    const take = Number.isFinite(takeRaw) ? Math.min(2000, Math.max(1, takeRaw)) : 1000;

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT u.inventoryItemId,
              u.unit,
              u.unitPrice,
              i.sku,
              i.name
         FROM userinventoryitemprice u
         LEFT JOIN inventoryitem i ON i.id = u.inventoryItemId
        WHERE u.userId = ?
          AND (
            ? = ''
            OR i.name COLLATE utf8mb4_unicode_ci LIKE ?
            OR i.sku COLLATE utf8mb4_unicode_ci LIKE ?
          )
        ORDER BY u.inventoryItemId ASC, u.unit ASC
        LIMIT ?`,
      repUserId,
      q,
      toMySqlContainsPattern(q),
      toMySqlContainsPattern(q),
      take,
    );

    return NextResponse.json(
      rows.map((r) => ({
        inventoryItemId: r.inventoryItemId,
        sku: r.sku ?? null,
        name: r.name ?? null,
        unit: r.unit,
        unitPrice: r.unitPrice,
      }))
    );
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
