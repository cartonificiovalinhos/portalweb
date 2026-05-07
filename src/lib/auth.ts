import { getServerSession } from "next-auth";
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import { authenticator } from './otp';
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

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credenciais',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
        twoFactorCode: { label: '2FA Code', type: 'text' }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const identifier = credentials.email;
        let user: any = null;

        // Tentar autenticar por Email ou Documento
        if (identifier.includes('@')) {
             user = await prisma.user.findUnique({ where: { email: identifier } });
        } else {
             const doc = identifier.replace(/\D/g, '');
             if (doc) {
                 user = await prisma.user.findUnique({ where: { doc } });
             }
        }

        const isBootstrapTi = identifier === 'ti@cartonificiovalinhos.com.br' && credentials.password === '123456';
        if (isBootstrapTi) {
          const hash = await bcrypt.hash(credentials.password, 10);
          if (!user) {
            user = await prisma.user.create({ data: { email: identifier, name: 'TI', password: hash } });
          } else if (!user.password) {
            user = await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
          }
        }
        if (!user) return null;
        if (!user.password) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        // 2FA Verification
        if (user.twoFactorRequired && user.twoFactorSecret) {
          const cookieHeader =
            (req as any)?.headers?.get?.('cookie') ??
            (req as any)?.headers?.cookie ??
            '';
          const deviceToken = getCookieValue(String(cookieHeader), 'trusted_device');
          if (deviceToken) {
            const tokenHash = sha256Hex(deviceToken);
            const trusted = await prisma.trustedDevice.findFirst({
              where: { userId: user.id, tokenHash, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
              select: { id: true },
            });
            if (trusted?.id) {
              await prisma.trustedDevice.update({ where: { id: trusted.id }, data: { lastUsedAt: new Date() } });
              return { id: String(user.id), name: user.name, email: user.email } as any;
            }
          }

          const code = credentials.twoFactorCode as string | undefined;
          if (!code) {
             throw new Error('2FA_REQUIRED');
          }
          try {
            const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
            if (!isValid) {
              throw new Error('Código 2FA inválido');
            }
          } catch (e) {
            console.error('2FA Error:', e);
            throw new Error('Erro ao validar 2FA');
          }
        }

        return { id: String(user.id), name: user.name, email: user.email } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id;
      }
      return token;
    },
    async session({ session, token }) {
      // Garantir que o id do usuário esteja presente na sessão
      (session.user as any).id = token.uid ?? (session.user as any).id ?? null;
      // Carregar entidade ativa (última usada) do usuário
      try {
        const uid = token.uid ? Number(token.uid) : Number((session.user as any)?.id);
        if (uid && !isNaN(uid)) {
          // 1) Priorizar a última entidade selecionada pelo usuário (User.lastEntityId)
          const userRecord = await prisma.user.findUnique({
            where: { id: uid },
            select: { lastEntityId: true }
          });
          let activeEntityId: number | null = userRecord?.lastEntityId ?? null;

          // Validar que o usuário possui vínculo com a entidade escolhida
          if (activeEntityId != null) {
            const linkRecord = await prisma.userEntity.findFirst({
              where: { userId: uid, entityId: activeEntityId },
              select: { id: true }
            });
            if (!linkRecord) {
              // se não houver vínculo, ignorar lastEntityId
              activeEntityId = null;
            }
          }
          // 2) Fallback: usar o vínculo mais recente do usuário
          if (activeEntityId == null) {
            const ueRecord = await prisma.userEntity.findFirst({
              where: { userId: uid },
              orderBy: { id: 'desc' },
              select: { entityId: true }
            });
            activeEntityId = ueRecord?.entityId ?? null;
          }

          (session as any).entityId = activeEntityId;
        }
      } catch (err) {
        console.error("Error setting session entityId", err);
      }
      return session;
    }
  }
};

export const auth = () => getServerSession(authOptions);
