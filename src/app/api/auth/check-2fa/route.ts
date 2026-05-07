import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { authenticator } from '../../../../lib/otp';
import crypto from 'crypto';

function sha256Hex(v: string): string {
  return crypto.createHash('sha256').update(v).digest('hex');
}

function getCookieValue(cookieHeader: string, name: string): string | null {
  const parts = String(cookieHeader || '').split(';');
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx <= 0) continue;
    const k = p.slice(0, idx).trim();
    if (k !== name) continue;
    return decodeURIComponent(p.slice(idx + 1).trim());
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha obrigatórios' }, { status: 400 });
    }

    let user: any = null;
    if (email.includes('@')) {
         user = await prisma.user.findUnique({ where: { email } });
    } else {
         const doc = email.replace(/\D/g, '');
         if (doc) {
             user = await prisma.user.findUnique({ where: { doc } });
         }
    }
    
    if (!user) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    if (!user.password) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    if (!user.twoFactorRequired) {
      return NextResponse.json({ required: false });
    }

    if (user.twoFactorSecret) {
      const cookieHeader = req.headers.get('cookie') || '';
      const deviceToken = getCookieValue(cookieHeader, 'trusted_device');
      if (deviceToken) {
        const tokenHash = sha256Hex(deviceToken);
        const trusted = await prisma.trustedDevice.findFirst({
          where: { userId: user.id, tokenHash, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          select: { id: true },
        });
        if (trusted?.id) {
          await prisma.trustedDevice.update({ where: { id: trusted.id }, data: { lastUsedAt: new Date() } });
          return NextResponse.json({ required: false, trustedDevice: true });
        }
      }

      return NextResponse.json({ required: true, setup: false });
    }

    // Need setup
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'Cartonificio Valinhos', secret);

    return NextResponse.json({ required: true, setup: true, secret, otpauth });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
