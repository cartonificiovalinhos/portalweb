import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../../lib/auth';
import { prisma } from '../../../../../../../lib/prisma';
import { isProgramAllowed } from '../../../../../../../lib/isProgramAllowed';

function isMissingTableError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('commercialfamilyapprovaluser') && (msg.includes('doesn\'t exist') || msg.includes('does not exist') || msg.includes('unknown table'));
}

export async function GET(_request: Request, ctx: { params: { id: string } }) {
  try {
    const familyId = Number(ctx?.params?.id);
    if (!Number.isFinite(familyId) || familyId <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const entityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_APPROVAL');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const rows = await prisma.commercialFamilyApprovalUser.findMany({
      where: { commercialFamilyId: familyId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        canView: true,
        discountFrom: true,
        discountTo: true,
        user: { select: { id: true, name: true, abbrevName: true, email: true, doc: true } },
      },
    });

    return NextResponse.json({ users: rows });
  } catch (err: any) {
    if (isMissingTableError(err)) return NextResponse.json({ users: [], warning: 'Tabela de aprovação ainda não existe no banco' });
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request: Request, ctx: { params: { id: string } }) {
  try {
    const familyId = Number(ctx?.params?.id);
    if (!Number.isFinite(familyId) || familyId <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const entityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_APPROVAL');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const body = await request.json().catch(() => ({} as any));
    const userId = Number(body?.userId);
    if (!Number.isFinite(userId) || userId <= 0) return NextResponse.json({ error: 'userId inválido' }, { status: 400 });

    const canView = body?.canView === undefined ? true : Boolean(body.canView);
    const discountFromRaw = body?.discountFrom;
    const discountToRaw = body?.discountTo;
    const discountFrom = discountFromRaw === null || discountFromRaw === undefined || discountFromRaw === '' ? null : Number(discountFromRaw);
    const discountTo = discountToRaw === null || discountToRaw === undefined || discountToRaw === '' ? null : Number(discountToRaw);
    if (discountFrom != null && !Number.isFinite(discountFrom)) return NextResponse.json({ error: 'discountFrom inválido' }, { status: 400 });
    if (discountTo != null && !Number.isFinite(discountTo)) return NextResponse.json({ error: 'discountTo inválido' }, { status: 400 });
    if (discountFrom != null && discountFrom < 0) return NextResponse.json({ error: 'discountFrom inválido' }, { status: 400 });
    if (discountTo != null && discountTo < 0) return NextResponse.json({ error: 'discountTo inválido' }, { status: 400 });
    if (discountFrom != null && discountTo != null && discountFrom > discountTo) return NextResponse.json({ error: 'Faixa de desconto inválida' }, { status: 400 });

    const saved = await prisma.commercialFamilyApprovalUser.upsert({
      where: { commercialFamilyId_userId: { commercialFamilyId: familyId, userId } },
      update: { canView, discountFrom, discountTo },
      create: { commercialFamilyId: familyId, userId, canView, discountFrom, discountTo },
      select: {
        id: true,
        canView: true,
        discountFrom: true,
        discountTo: true,
        user: { select: { id: true, name: true, abbrevName: true, email: true, doc: true } },
      },
    });

    return NextResponse.json({ ok: true, user: saved });
  } catch (err: any) {
    if (isMissingTableError(err)) return NextResponse.json({ error: 'Tabela de aprovação ainda não existe no banco' }, { status: 500 });
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: { params: { id: string } }) {
  try {
    const familyId = Number(ctx?.params?.id);
    if (!Number.isFinite(familyId) || familyId <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    const entityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const allowed = await isProgramAllowed(uid, entityId, 'ADMIN_APPROVAL');
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const body = await request.json().catch(() => ({} as any));
    const userId = Number(body?.userId);
    if (!Number.isFinite(userId) || userId <= 0) return NextResponse.json({ error: 'userId inválido' }, { status: 400 });

    await prisma.commercialFamilyApprovalUser.deleteMany({
      where: { commercialFamilyId: familyId, userId },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isMissingTableError(err)) return NextResponse.json({ error: 'Tabela de aprovação ainda não existe no banco' }, { status: 500 });
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
