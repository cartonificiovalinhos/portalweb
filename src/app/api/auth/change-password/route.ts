import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { authenticator } from '../../../../lib/otp';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const uidRaw = (session?.user as any)?.id;
    const userId = uidRaw != null ? Number(uidRaw) : NaN;
    if (!session || !userId || Number.isNaN(userId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const currentPassword = String(body?.currentPassword || '');
    const newPassword = String(body?.newPassword || '');
    const twoFactorCode = body?.twoFactorCode == null ? null : String(body.twoFactorCode);

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'A nova senha deve ter pelo menos 6 caracteres' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, twoFactorRequired: true, twoFactorSecret: true },
    });
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    if (!user.password) return NextResponse.json({ error: 'Usuário sem senha cadastrada' }, { status: 400 });

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 });

    const requires2fa = Boolean(user.twoFactorRequired && user.twoFactorSecret);
    if (requires2fa) {
      const code = (twoFactorCode || '').trim();
      if (!code) {
        return NextResponse.json({ requiresTwoFactor: true }, { status: 409 });
      }
      const valid = await authenticator.verify({ token: code, secret: String(user.twoFactorSecret) });
      if (!valid) return NextResponse.json({ error: 'Código 2FA inválido' }, { status: 401 });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hash } });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
