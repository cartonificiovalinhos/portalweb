import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: '.env.local' });
  dotenv.config({ path: '.env' });
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não configurada para inicializar o Prisma.');
}

const globalForPrisma = global as unknown as { prisma?: PrismaClient };
const adapter = new PrismaMariaDb(process.env.DATABASE_URL);

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ adapter, log: ['error', 'warn'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
