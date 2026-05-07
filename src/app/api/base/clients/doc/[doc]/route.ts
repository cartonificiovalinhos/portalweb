import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';

function normalizeDoc(doc: string): string {
  return (doc || '').replace(/\D+/g, '');
}

async function ensurePaymentTermByCode(code: number): Promise<number | null> {
  const c = Number(code);
  if (!Number.isFinite(c) || c <= 0) return null;
  const row = await prisma.paymentTerm
    .upsert({
      where: { code: Math.trunc(c) },
      update: {},
      create: { code: Math.trunc(c), description: `Condição ${Math.trunc(c)}`, installments: 1 },
      select: { id: true },
    })
    .catch(() => null);
  return row?.id ? Number(row.id) : null;
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

  const str = (v: any): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s ? s : null;
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
    const createdId = await ensurePaymentTermByCode(codeCandidate);
    if (createdId) return createdId;
  }

  const descCandidate =
    str(body?.paymentTermDescription) ??
    str(body?.paymentTermsDescription) ??
    str(body?.condPagtoDescription) ??
    str(body?.condPagtoDesc) ??
    str(body?.paymentTerms) ??
    str(body?.paymentTerm) ??
    null;
  if (descCandidate) {
    const term = await prisma.paymentTerm.findFirst({
      where: { description: { equals: descCandidate } },
      select: { id: true },
    }).catch(() => null);
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
  const createdId = await ensurePaymentTermByCode(Math.trunc(n));
  if (createdId) return createdId;

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

export async function GET(_: Request, props: { params: Promise<{ doc: string }> }) {
  const params = await props.params;
  try {
    const raw = params.doc ?? '';
    const doc = normalizeDoc(raw);
    if (!doc) return NextResponse.json({ error: 'doc inválido' }, { status: 400 });
    const client = await prisma.client.findFirst({
      where: { doc },
      select: {
        id: true,
        doc: true,
        name: true,
        abbrevName: true,
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

export async function PATCH(request: Request, props: { params: Promise<{ doc: string }> }) {
  const params = await props.params;
  try {
    const raw = params.doc ?? '';
    const doc = normalizeDoc(raw);
    if (!doc) return NextResponse.json({ error: 'doc inválido' }, { status: 400 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const fields: any = {};
    if (body.doc !== undefined) fields.doc = normalizeDoc(String(body.doc || '')) || null;
    if (body.name !== undefined) fields.name = String(body.name || '').trim();
    if (body.abbrevName !== undefined || body.shortName !== undefined || body.nomeAbreviado !== undefined || body.nome_abreviado !== undefined) {
      const v = body.abbrevName ?? body.shortName ?? body.nomeAbreviado ?? body.nome_abreviado;
      const s = String(v || '').trim();
      fields.abbrevName = s ? s.slice(0, 20) : null;
    }
    if (body.cep !== undefined) fields.cep = String(body.cep || '').trim() || null;
    if (body.logradouro !== undefined) fields.logradouro = String(body.logradouro || '').trim() || null;
    if (body.numero !== undefined) fields.numero = String(body.numero || '').trim() || null;
    if (body.bairro !== undefined) fields.bairro = String(body.bairro || '').trim() || null;
    if (body.cidade !== undefined) fields.cidade = String(body.cidade || '').trim() || null;
    if (body.estado !== undefined) fields.estado = String(body.estado || '').trim() || null;
    const paymentTermIds = await resolvePaymentTermIds(body);
    const listProvided = paymentTermIds !== null;
    const singleProvided = !listProvided && (body.paymentTermId !== undefined || body.paymentTermCode !== undefined || body.condPagto !== undefined || body.condPagtoCode !== undefined);
    if (listProvided && paymentTermIds.length === 0) {
      return NextResponse.json(
        { error: 'condicoesPagamento informado, mas nenhuma condição foi reconhecida (verifique se o código existe em paymentterm.code)' },
        { status: 400 }
      );
    }
    if (listProvided) {
      fields.paymentTermId = paymentTermIds[0] ?? null;
    } else if (singleProvided) {
      fields.paymentTermId = await resolvePaymentTermId(body);
    }
    const setCols = Object.keys(fields);
    if (setCols.length === 0) return NextResponse.json({ message: 'Nada para atualizar' }, { status: 400 });
    const data: any = {};
    for (const k of setCols) data[k] = (fields as any)[k];
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.client.update({
        where: { doc },
        data,
        select: {
          id: true,
          doc: true,
          name: true,
          abbrevName: true,
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

      await tx.clientItem.deleteMany({
        where: {
          clientId: row.id,
          manual: false,
        },
      });
      await tx.userClientRep.deleteMany({ where: { clientId: row.id } });

      if (listProvided || singleProvided) {
        const syncIds = listProvided ? paymentTermIds : (row.paymentTermId ? [row.paymentTermId] : []);
        await tx.clientPaymentTerm.deleteMany({ where: { clientId: row.id } });
        if (syncIds.length > 0) {
          await tx.clientPaymentTerm.createMany({
            data: syncIds.map((ptId, idx) => ({
              clientId: row.id,
              paymentTermId: ptId,
              position: idx,
            })),
            skipDuplicates: true,
          });
        }
      }

      return row;
    });

    return NextResponse.json({
      ...updated,
      paymentTermCode: updated.paymentTerm?.code ?? null,
      paymentTermDescription: updated.paymentTerm?.description ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
