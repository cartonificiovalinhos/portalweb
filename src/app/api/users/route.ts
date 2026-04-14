import { NextResponse } from 'next/server';
// Rebuild trigger: Fix webpack runtime error
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';

function normalizeDoc(doc: string): string {
  return (doc || '').replace(/\D+/g, '');
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
  const data = await request.json();
  const { name, email, password, erpIntegrationMode, salesRepAdmin } = data || {};
  const abbrevName = (data as any)?.abbrevName != null ? String((data as any).abbrevName).trim().slice(0, 15) : null;
  const doc = normalizeDoc(String((data as any)?.doc || '')) || null;
  const passwordStr = String(password || '');
  if (!passwordStr) return NextResponse.json({ error: 'password é obrigatório' }, { status: 400 });
  const hashed = await bcrypt.hash(passwordStr, 10);

  let finalEmail = email;
  if (email) {
    const found = await prisma.user
      .findUnique({ where: { email: String(email) }, select: { doc: true } })
      .catch(() => null);
    if (found) {
      const isSameUser = doc && found.doc === doc;
      if (!isSameUser) finalEmail = null;
    }
  }

  if (doc) {
    const update: any = {
      name: String(name || ''),
      abbrevName,
      email: finalEmail ?? null,
      password: String(hashed),
      erpIntegrationMode: String(erpIntegrationMode || 'TEST'),
    };
    if (salesRepAdmin !== undefined) update.salesRepAdmin = Boolean(salesRepAdmin);

    const create: any = {
      name: String(name || ''),
      abbrevName,
      email: finalEmail ?? null,
      password: String(hashed),
      doc,
      salesRepAdmin: Boolean(salesRepAdmin),
      isSalesAdmin: false,
      erpIntegrationMode: String(erpIntegrationMode || 'TEST'),
    };
    const upserted = await prisma.user.upsert({
      where: { doc },
      update,
      create,
      select: {
        id: true,
        name: true,
        abbrevName: true,
        email: true,
        doc: true,
        salesRepAdmin: true,
        isSalesAdmin: true,
        erpIntegrationMode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(upserted);
  }
  
  const created = await prisma.user.create({ 
    data: { name, abbrevName, email: finalEmail, password: hashed, erpIntegrationMode: erpIntegrationMode || 'TEST', salesRepAdmin: Boolean(salesRepAdmin), isSalesAdmin: false }, 
    select: { id: true, name: true, abbrevName: true, email: true, createdAt: true, updatedAt: true, salesRepAdmin: true, isSalesAdmin: true, erpIntegrationMode: true } 
  });
  return NextResponse.json(created);
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const id = Number(body?.id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const update: any = {};
    if (body.name !== undefined) update.name = String(body.name);
    if (body.abbrevName !== undefined) update.abbrevName = body.abbrevName == null ? null : String(body.abbrevName).trim().slice(0, 15);
    if (body.email !== undefined) update.email = body.email == null ? null : String(body.email);
    if (body.erpIntegrationMode !== undefined) update.erpIntegrationMode = String(body.erpIntegrationMode);
    if (body.salesRepAdmin !== undefined) update.salesRepAdmin = Boolean(body.salesRepAdmin);
    if (body.isSalesAdmin !== undefined) update.isSalesAdmin = Boolean(body.isSalesAdmin);
    if (body.twoFactorRequired !== undefined) update.twoFactorRequired = Boolean(body.twoFactorRequired);
    if (body.doc !== undefined) update.doc = normalizeDoc(String(body.doc || '')) || null;
    if (body.password !== undefined && String(body.password).length > 0) {
      update.password = await bcrypt.hash(String(body.password), 10);
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
