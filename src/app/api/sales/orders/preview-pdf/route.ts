import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { renderSalesOrderPdf, salesOrderPdfFileName } from '../../../../../lib/sales-order-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveActiveEntity(session: any) {
  const sessionEntityIdRaw = session?.entityId ?? session?.activeEntityId ?? null;
  const sessionEntityId = sessionEntityIdRaw != null ? Number(sessionEntityIdRaw) : null;
  if (Number.isFinite(sessionEntityId) && Number(sessionEntityId) > 0) {
    return prisma.entity.findUnique({ where: { id: Math.trunc(Number(sessionEntityId)) } });
  }

  const uid = session?.user ? Number(session.user.id) : NaN;
  if (!Number.isFinite(uid) || uid <= 0) return null;

  const user = await prisma.user.findUnique({
    where: { id: Math.trunc(uid) },
    select: { lastEntityId: true },
  });
  const lastEntityId = Number(user?.lastEntityId ?? 0);
  if (!Number.isFinite(lastEntityId) || lastEntityId <= 0) return null;
  return prisma.entity.findUnique({ where: { id: Math.trunc(lastEntityId) } });
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new Response('Unauthorized', { status: 401 });

    const body = await request.json().catch(() => null as any);
    if (!body || typeof body !== 'object') {
      return new Response('Payload inválido', { status: 400 });
    }

    const entity = await resolveActiveEntity(session as any);
    const payload = {
      ...body,
      entity: body?.entity ?? (entity ? { name: entity.name, cnpj: entity.cnpj } : null),
      code: String(body?.code || 'RASCUNHO'),
      status: String(body?.status || 'Novo'),
      orderDate: body?.orderDate || new Date().toISOString(),
      items: Array.isArray(body?.items) ? body.items : [],
    };

    const pdf = await renderSalesOrderPdf(payload);
    const fileName = salesOrderPdfFileName(payload);

    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      }
    });
  } catch (err: any) {
    console.error('preview-pdf error', err);
    return new Response(String(err?.message || err || 'Erro ao gerar PDF'), { status: 500 });
  }
}
