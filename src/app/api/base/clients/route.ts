import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';

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

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id ? Number((session?.user as any).id) : null;
    
    // Se não houver usuário logado, retorna lista vazia (ou erro 401 se preferir)
    if (!userId) return NextResponse.json([]);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSalesAdmin: true }
    });
    const isSalesAdmin = Boolean(user?.isSalesAdmin);

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    const digits = q ? normalizeDoc(q) : '';
    const qNum = q ? Number(q) : NaN;
    const idCandidate = Number.isFinite(qNum) ? Math.trunc(qNum) : null;

    const where: any = {};
    if (!isSalesAdmin) where.reps = { some: { userId } };

    if (q) {
      const or: any[] = [
        { name: { contains: q } },
        { cidade: { contains: q } },
        { estado: { contains: q } },
      ];
      if (digits) or.push({ doc: { contains: digits } });
      if (idCandidate !== null) or.push({ id: idCandidate });
      where.OR = or;
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
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

    const out = clients.map((c) => ({
      id: c.id,
      doc: c.doc,
      name: c.name,
      abbrevName: c.abbrevName,
      cep: c.cep,
      logradouro: c.logradouro,
      numero: c.numero,
      bairro: c.bairro,
      cidade: c.cidade,
      estado: c.estado,
      creditLimit: c.creditLimit,
      availableLimit: c.availableLimit,
      titlesDue: c.titlesDue,
      titlesOverdue: c.titlesOverdue,
      paymentTermId: c.paymentTermId,
      paymentTermCode: c.paymentTerm?.code ?? null,
      paymentTermDescription: c.paymentTerm?.description ?? null,
    }));
    return NextResponse.json(out);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const doc = normalizeDoc(String(body?.doc || '')) || null;
    const name = String(body?.name || '').trim();
    const abbrevCandidate =
      body?.abbrevName ??
      body?.shortName ??
      body?.nomeAbreviado ??
      body?.nome_abreviado;
    const abbrevName =
      abbrevCandidate === undefined ? undefined : (String(abbrevCandidate || '').trim() || null);
    const cep = String(body?.cep || '').trim() || null;
    const logradouro = String(body?.logradouro || '').trim() || null;
    const numero = String(body?.numero || '').trim() || null;
    const bairro = String(body?.bairro || '').trim() || null;
    const cidade = String(body?.cidade || '').trim() || null;
    const estado = String(body?.estado || '').trim() || null;
    const paymentTermIds = await resolvePaymentTermIds(body);
    const listProvided = paymentTermIds !== null;
    const paymentTermId = listProvided ? (paymentTermIds[0] ?? null) : await resolvePaymentTermId(body);
    if (!name) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    if (listProvided && paymentTermIds.length === 0) {
      return NextResponse.json(
        { error: 'condicoesPagamento informado, mas nenhuma condição foi reconhecida (verifique se o código existe em paymentterm.code)' },
        { status: 400 }
      );
    }

    const syncPaymentTermIds = listProvided ? paymentTermIds : (paymentTermId ? [paymentTermId] : null);

    const created = await prisma.$transaction(async (tx) => {
      const baseData: any = {
        name,
        cep,
        logradouro,
        numero,
        bairro,
        cidade,
        estado,
      };

      if (abbrevName !== undefined) {
        baseData.abbrevName = abbrevName ? String(abbrevName).slice(0, 20) : null;
      }

      if (listProvided) {
        baseData.paymentTermId = paymentTermId;
      } else if (paymentTermId !== null) {
        baseData.paymentTermId = paymentTermId;
      }

      const client = doc
        ? await tx.client.upsert({
            where: { doc },
            update: baseData,
            create: { ...baseData, doc },
            select: { id: true, doc: true, name: true, abbrevName: true, cep: true, logradouro: true, numero: true, bairro: true, cidade: true, estado: true, paymentTermId: true },
          })
        : await tx.client.create({
            data: { ...baseData, doc: null },
            select: { id: true, doc: true, name: true, abbrevName: true, cep: true, logradouro: true, numero: true, bairro: true, cidade: true, estado: true, paymentTermId: true },
          });

      if (syncPaymentTermIds !== null) {
        await tx.clientPaymentTerm.deleteMany({ where: { clientId: client.id } });
        if (syncPaymentTermIds.length > 0) {
          await tx.clientPaymentTerm.createMany({
            data: syncPaymentTermIds.map((id, idx) => ({
              clientId: client.id,
              paymentTermId: id,
              position: idx,
            })),
            skipDuplicates: true,
          });
        }
      }

      return client;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
