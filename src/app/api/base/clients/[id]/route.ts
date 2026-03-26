import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

function normalizeDoc(doc: string): string {
  return (doc || '').replace(/\D+/g, '');
}

async function ensureClientPaymentTermColumn() {
  await prisma.$executeRawUnsafe('ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "paymentTermId" INTEGER');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Client_paymentTermId_idx" ON "Client" ("paymentTermId")');
}

async function ensureClientPaymentTermsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ClientPaymentTerm" (
      "id" SERIAL PRIMARY KEY,
      "clientId" INTEGER NOT NULL,
      "paymentTermId" INTEGER NOT NULL,
      "position" INTEGER DEFAULT 0,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "ClientPaymentTerm_clientId_paymentTermId_key" ON "ClientPaymentTerm" ("clientId","paymentTermId")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ClientPaymentTerm_clientId_idx" ON "ClientPaymentTerm" ("clientId")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ClientPaymentTerm_paymentTermId_idx" ON "ClientPaymentTerm" ("paymentTermId")');
}

async function resolvePaymentTermId(body: any): Promise<number | null> {
  const num = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
    const s = String(v).trim();
    if (!s) return null;
    const digits = s.replace(/\D/g, '');
    if (!digits) return null;
    const n = Number(digits);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };

  const idCandidate =
    num(body?.paymentTermId) ??
    num(body?.paymentTermsId) ??
    num(body?.condPagtoId) ??
    null;
  if (idCandidate) return idCandidate;

  const codeCandidate =
    num(body?.paymentTermsErp) ??
    num(body?.paymentTermCode) ??
    num(body?.paymentTermsCode) ??
    num(body?.condPagtoCode) ??
    num(body?.condPagto) ??
    null;
  if (codeCandidate) {
    const term = await prisma.paymentTerm.findFirst({ where: { code: codeCandidate }, select: { id: true } }).catch(() => null);
    if (term?.id) return term.id;
  }

  return null;
}

function extractPaymentTermList(body: any): any[] | null {
  const candidates = [
    body?.paymentTermIds,
    body?.paymentTermsIds,
    body?.paymentTermsList,
    body?.paymentTerms,
    body?.condPagtoList,
    body?.condPagtoLista,
    body?.condicoesPagamento,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return null;
}

async function resolvePaymentTermIdFromAny(v: any): Promise<number | null> {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return resolvePaymentTermId(v);

  const s = String(v).trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n)) return null;

  const byCode = await prisma.paymentTerm.findFirst({ where: { code: Math.trunc(n) }, select: { id: true } }).catch(() => null);
  if (byCode?.id) return byCode.id;

  const byId = await prisma.paymentTerm.findFirst({ where: { id: Math.trunc(n) }, select: { id: true } }).catch(() => null);
  if (byId?.id) return byId.id;

  return null;
}

async function resolvePaymentTermIds(body: any): Promise<number[] | null> {
  const list = extractPaymentTermList(body);
  if (!list) return null;
  const out: number[] = [];
  const seen = new Set<number>();
  for (const it of list) {
    const id = await resolvePaymentTermIdFromAny(it);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }
    const client = await prisma.client.findUnique({
      where: { id: Math.trunc(id) },
      select: {
        id: true,
        doc: true,
        name: true,
        cep: true,
        logradouro: true,
        numero: true,
        bairro: true,
        cidade: true,
        estado: true,
        creditLimit: true,
        availableLimit: true,
        titlesDue: true,
        titlesOverdue: true,
        paymentTermId: true,
        paymentTerm: { select: { code: true, description: true } },
      },
    });
    if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    return NextResponse.json({
      ...client,
      paymentTermCode: client.paymentTerm?.code ?? null,
      paymentTermDescription: client.paymentTerm?.description ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await ensureClientPaymentTermColumn();
    await ensureClientPaymentTermsTable();
    const id = Number(params.id);
    const body = await request.json();
    const fields: any = {};
    if (body.doc !== undefined) fields.doc = normalizeDoc(String(body.doc || '')) || null;
    if (body.name !== undefined) fields.name = String(body.name || '').trim();
    if (body.cep !== undefined) fields.cep = String(body.cep || '').trim() || null;
    if (body.logradouro !== undefined) fields.logradouro = String(body.logradouro || '').trim() || null;
    if (body.numero !== undefined) fields.numero = String(body.numero || '').trim() || null;
    if (body.bairro !== undefined) fields.bairro = String(body.bairro || '').trim() || null;
    if (body.cidade !== undefined) fields.cidade = String(body.cidade || '').trim() || null;
    if (body.estado !== undefined) fields.estado = String(body.estado || '').trim() || null;
    const paymentTermIds = await resolvePaymentTermIds(body);
    const listProvided = paymentTermIds !== null;
    const singleProvided = !listProvided && (body.paymentTermId !== undefined || body.paymentTermCode !== undefined || body.condPagto !== undefined || body.condPagtoCode !== undefined);
    if (listProvided) {
      fields.paymentTermId = paymentTermIds[0] ?? null;
    } else if (singleProvided) {
      fields.paymentTermId = await resolvePaymentTermId(body);
    }
    const setCols = Object.keys(fields);
    if (setCols.length === 0) return NextResponse.json({ message: 'Nada para atualizar' }, { status: 400 });
    const assignments = setCols.map((k) => `${k}=?`).join(', ');
    const values = setCols.map((k) => (fields as any)[k]);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE "Client" SET ${assignments}, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
        ...values,
        id
      );
      if (listProvided || singleProvided) {
        const syncIds = listProvided ? paymentTermIds : (fields.paymentTermId ? [fields.paymentTermId] : []);
        await tx.clientPaymentTerm.deleteMany({ where: { clientId: id } });
        if (syncIds.length > 0) {
          await tx.clientPaymentTerm.createMany({
            data: syncIds.map((ptId, idx) => ({
              clientId: id,
              paymentTermId: ptId,
              position: idx,
            })),
            skipDuplicates: true,
          });
        }
      }
    });
    const row: any[] = await prisma.$queryRawUnsafe('SELECT * FROM "Client" WHERE id=?', id);
    return NextResponse.json(row[0] ?? { ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    await prisma.$executeRawUnsafe('DELETE FROM "Client" WHERE id=?', id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
