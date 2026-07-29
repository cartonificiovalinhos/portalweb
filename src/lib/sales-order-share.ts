import crypto from 'crypto';
import { Prisma } from '@prisma/client';

const PUBLIC_CODE_SIZE = 8;
const SIGNATURE_SIZE = 24;

export const salesOrderMirrorInclude = {
  entity: true,
  client: true,
  items: {
    include: {
      inventoryItem: { include: { commercialFamily: true } }
    },
    orderBy: { id: 'asc' }
  }
} satisfies Prisma.SalesOrderInclude;

export function isValidPublicMirrorCode(value: string): boolean {
  return /^[a-z0-9]{32}$/.test(String(value || ''));
}

function getMirrorSecret(): string {
  const secret =
    process.env.ORDER_PUBLIC_LINK_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error('Defina ORDER_PUBLIC_LINK_SECRET ou NEXTAUTH_SECRET para gerar links públicos');
  }
  return secret;
}

function makeSignature(payload: string): string {
  return crypto
    .createHmac('sha256', getMirrorSecret())
    .update(`sales-order-mirror:${payload}`)
    .digest('hex')
    .slice(0, SIGNATURE_SIZE);
}

export function makeSalesOrderPublicMirrorCode(orderId: number): string {
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new Error('ID de pedido inválido');
  }
  const payload = orderId.toString(36).padStart(PUBLIC_CODE_SIZE, '0');
  return `${makeSignature(payload)}${payload}`;
}

export function getSalesOrderIdFromPublicMirrorCode(code: string): number | null {
  const normalized = String(code || '').trim().toLowerCase();
  if (!isValidPublicMirrorCode(normalized)) {
    return null;
  }

  const payload = normalized.slice(-PUBLIC_CODE_SIZE);
  const signature = normalized.slice(0, -PUBLIC_CODE_SIZE);
  if (makeSignature(payload) !== signature) {
    return null;
  }

  const orderId = Number.parseInt(payload, 36);
  return Number.isInteger(orderId) && orderId > 0 ? orderId : null;
}
