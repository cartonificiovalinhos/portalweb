import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = Number(params.id);
    const links = await prisma.standardOccurrenceFamily.findMany({
      where: { occurrenceId: id },
      include: { family: { select: { id: true, description: true } } },
      orderBy: { family: { description: 'asc' } },
    });
    return NextResponse.json(links.map((l) => ({ id: l.family.id, description: l.family.description })));
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = Number(params.id);
    const body = await request.json().catch(() => ({}));
    const familyIds: number[] = Array.isArray(body.familyIds) ? body.familyIds.map((n: any) => Number(n)).filter((n) => Number.isFinite(n)) : [];

    await prisma.standardOccurrenceFamily.deleteMany({ where: { occurrenceId: id } });
    if (familyIds.length > 0) {
      await prisma.standardOccurrenceFamily.createMany({
        data: familyIds.map((familyId) => ({ occurrenceId: id, familyId })),
        skipDuplicates: true,
      });
    }
    return NextResponse.json({ ok: true, occurrenceId: id, familyIds });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
