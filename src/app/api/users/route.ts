import { NextResponse } from 'next/server';
// Rebuild trigger: Fix webpack runtime error
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';

function normalizeDoc(doc: string): string {
  return (doc || '').replace(/\D+/g, '');
}

function normalizeOptionalEmail(email: unknown): string | null {
  const value = String(email ?? '').trim();
  return value || null;
}

function validateUserIdentifier(doc: string | null, email: string | null): string | null {
  if (!doc && !email) {
    return 'Informe CPF/CNPJ ou E-mail.';
  }
  return null;
}

function mapUserWriteError(err: unknown): string | null {
  const code = typeof err === 'object' && err !== null ? String((err as any).code || '') : '';
  const message = String((err as any)?.message || err || '');
  if (code === 'P2002' || message.includes('User_email_key')) {
    const target = Array.isArray((err as any)?.meta?.target)
      ? (err as any).meta.target.map((item: unknown) => String(item).toLowerCase())
      : [];
    if (target.includes('doc') || message.includes('User_doc_key')) {
      return 'CPF/CNPJ já está vinculado a outro usuário.';
    }
    return 'E-mail já está vinculado a outro usuário.';
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const salesRepAdmin = url.searchParams.get('salesRepAdmin');
    const onlyReps = !!(salesRepAdmin && ['1','true','yes'].includes(String(salesRepAdmin).toLowerCase()));

    const fetchUsersWithAbbrev = async () => prisma.user.findMany({
      where: onlyReps ? { salesRepAdmin: true } : undefined,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        abbrevName: true,
        email: true,
        doc: true,
        salesRepAdmin: true,
        isSalesAdmin: true,
        twoFactorRequired: true,
        twoFactorSecret: true,
        erpIntegrationMode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const fetchUsersWithoutAbbrev = async () => prisma.user.findMany({
      where: onlyReps ? { salesRepAdmin: true } : undefined,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        doc: true,
        salesRepAdmin: true,
        isSalesAdmin: true,
        twoFactorRequired: true,
        twoFactorSecret: true,
        erpIntegrationMode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let users: any[] = [];
    try {
      users = await fetchUsersWithAbbrev();
    } catch (err: any) {
      const msg = String(err?.message || err || '').toLowerCase();
      if (msg.includes('abbrevname') && (msg.includes('unknown column') || msg.includes('does not exist'))) {
        users = await fetchUsersWithoutAbbrev();
      } else {
        throw err;
      }
    }

    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        abbrevName: (u as any).abbrevName ?? null,
        email: u.email,
        doc: u.doc,
        salesRepAdmin: u.salesRepAdmin,
        isSalesAdmin: u.isSalesAdmin,
        twoFactorRequired: u.twoFactorRequired,
        erpIntegrationMode: u.erpIntegrationMode,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        hasTwoFactorSecret: u.twoFactorSecret != null,
      }))
    );
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { name, password, erpIntegrationMode, salesRepAdmin } = data || {};
    const abbrevName = (data as any)?.abbrevName != null ? String((data as any).abbrevName).trim().slice(0, 15) : null;
    const doc = normalizeDoc(String((data as any)?.doc || '')) || null;
    const email = normalizeOptionalEmail((data as any)?.email);
    const identifierError = validateUserIdentifier(doc, email);
    if (identifierError) return NextResponse.json({ error: identifierError }, { status: 400 });
    const passwordStr = String(password || '');
    if (!passwordStr) return NextResponse.json({ error: 'password é obrigatório' }, { status: 400 });
    const hashed = await bcrypt.hash(passwordStr, 10);

    if (doc) {
      const foundByDoc = await prisma.user.findUnique({
        where: { doc },
        select: { id: true },
      }).catch(() => null);
      if (foundByDoc) {
        return NextResponse.json({ error: 'CPF/CNPJ já está vinculado a outro usuário.' }, { status: 400 });
      }
    }

    const finalEmail = email;
    if (email) {
      const found = await prisma.user.findUnique({
        where: { email: String(email) },
        select: { id: true },
      }).catch(() => null);
      if (found) {
        return NextResponse.json({ error: 'E-mail já está vinculado a outro usuário.' }, { status: 400 });
      }
    }

    const created = await prisma.user.create({
      data: {
        name: String(name || ''),
        abbrevName,
        email: finalEmail,
        password: hashed,
        doc,
        erpIntegrationMode: erpIntegrationMode || 'TEST',
        salesRepAdmin: Boolean(salesRepAdmin),
        isSalesAdmin: false,
      },
      select: {
        id: true,
        name: true,
        abbrevName: true,
        email: true,
        doc: true,
        createdAt: true,
        updatedAt: true,
        salesRepAdmin: true,
        isSalesAdmin: true,
        erpIntegrationMode: true,
      }
    });
    return NextResponse.json(created);
  } catch (err: any) {
    const mappedError = mapUserWriteError(err);
    if (mappedError) {
      return NextResponse.json({ error: mappedError }, { status: 400 });
    }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const id = Number(body?.id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const current = await prisma.user.findUnique({
      where: { id },
      select: { id: true, doc: true, email: true },
    });
    if (!current) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    const update: any = {};
    if (body.name !== undefined) update.name = String(body.name);
    if (body.abbrevName !== undefined) update.abbrevName = body.abbrevName == null ? null : String(body.abbrevName).trim().slice(0, 15);
    if (body.email !== undefined) update.email = normalizeOptionalEmail(body.email);
    if (body.erpIntegrationMode !== undefined) update.erpIntegrationMode = String(body.erpIntegrationMode);
    if (body.salesRepAdmin !== undefined) update.salesRepAdmin = Boolean(body.salesRepAdmin);
    if (body.isSalesAdmin !== undefined) update.isSalesAdmin = Boolean(body.isSalesAdmin);
    if (body.twoFactorRequired !== undefined) update.twoFactorRequired = Boolean(body.twoFactorRequired);
    if (body.doc !== undefined) update.doc = normalizeDoc(String(body.doc || '')) || null;
    if (body.password !== undefined && String(body.password).length > 0) {
      update.password = await bcrypt.hash(String(body.password), 10);
    }

    const nextDoc = update.doc !== undefined ? update.doc : current.doc;
    const nextEmail = update.email !== undefined ? update.email : current.email;
    const identifierError = validateUserIdentifier(nextDoc, nextEmail);
    if (identifierError) return NextResponse.json({ error: identifierError }, { status: 400 });

    if (update.doc) {
      const found = await prisma.user.findUnique({
        where: { doc: String(update.doc) },
        select: { id: true },
      }).catch(() => null);
      if (found && found.id !== id) {
        return NextResponse.json({ error: 'CPF/CNPJ já está vinculado a outro usuário.' }, { status: 400 });
      }
    }

    if (update.email) {
      const found = await prisma.user.findUnique({
        where: { email: String(update.email) },
        select: { id: true },
      }).catch(() => null);
      if (found && found.id !== id) {
        return NextResponse.json({ error: 'E-mail já está vinculado a outro usuário.' }, { status: 400 });
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: update,
      select: {
        id: true,
        name: true,
        abbrevName: true,
        email: true,
        doc: true,
        createdAt: true,
        updatedAt: true,
        salesRepAdmin: true,
        isSalesAdmin: true,
        twoFactorRequired: true,
        twoFactorSecret: true,
        erpIntegrationMode: true,
      },
    });
    return NextResponse.json({ ...updated, hasTwoFactorSecret: updated.twoFactorSecret != null });
  } catch (err: any) {
    const mappedError = mapUserWriteError(err);
    if (mappedError) {
      return NextResponse.json({ error: mappedError }, { status: 400 });
    }
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const ids: number[] = Array.isArray(body?.ids) ? (body.ids as any[]).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0) : [];
    if (!ids.length) return NextResponse.json({ error: 'IDs obrigatórios' }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({ where: { id: { in: ids } }, data: { lastEntityId: null } });
      await tx.userEntityModuleProgram.deleteMany({
        where: { userEntityModule: { userEntity: { userId: { in: ids } } } },
      });
      await tx.userEntityModule.deleteMany({
        where: { userEntity: { userId: { in: ids } } },
      });
      await tx.userEntity.deleteMany({ where: { userId: { in: ids } } });
      return tx.user.deleteMany({ where: { id: { in: ids } } });
    });
    return NextResponse.json({ deleted: result.count });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
