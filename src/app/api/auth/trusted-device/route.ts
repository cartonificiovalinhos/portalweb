import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import crypto from 'crypto';

function sha256Hex(v: string): string {
  return crypto.createHash('sha256').update(v).digest('hex');
}

function makeToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json().catch(() => ({} as any));
    const action = String(body?.action || 'trust').trim().toLowerCase();
    if (action !== 'trust') return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

    const token = makeToken();
    const tokenHash = sha256Hex(token);
    const userAgent = request.headers.get('user-agent') || null;

    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    await prisma.trustedDevice.create({
      data: { userId: uid, tokenHash, userAgent, expiresAt, lastUsedAt: new Date() },
      select: { id: true },
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set('trusted_device', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: expiresAt,
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

