import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

function normalizeDoc(doc: string): string {
  return (doc || '').replace(/\D+/g, '');
}

type ClientContactInput = {
  id?: number | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  isWhatsapp?: boolean | null;
};

function normalizePhone(phone: string): string {
  return String(phone || '').replace(/\D+/g, '');
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function toOptionalPositiveInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const digits = String(value).trim().replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function buildContactDescription(kind: 'phone' | 'email', index: number, value?: string | null, description?: string | null): string {
  const label = String(description || '').trim();
  if (label) return label.slice(0, 120);
  const fallbackValue = String(value || '').trim();
  if (fallbackValue) return `${kind === 'phone' ? 'Telefone' : 'E-mail'} ${index + 1}`;
  return kind === 'phone' ? 'Telefone' : 'E-mail';
}

function extractClientContacts(body: any): ClientContactInput[] | null {
  if (Array.isArray(body?.contacts)) {
    return body.contacts;
  }

  const phones = Array.isArray(body?.phones) ? body.phones : null;
  const emails = Array.isArray(body?.emails) ? body.emails : null;
  if (!phones && !emails) return null;

  const out: ClientContactInput[] = [];
  if (phones) {
    phones.forEach((item: any, index: number) => {
      if (item && typeof item === 'object') {
        out.push({
          id: item.id,
          description: item.description,
          phone: item.phone,
          isWhatsapp: item.isWhatsapp,
        });
        return;
      }
      out.push({ description: `Telefone ${index + 1}`, phone: String(item ?? '') });
    });
  }

  if (emails) {
    emails.forEach((item: any, index: number) => {
      if (item && typeof item === 'object') {
        out.push({
          id: item.id,
          description: item.description,
          email: item.email,
        });
        return;
      }
      out.push({ description: `E-mail ${index + 1}`, email: String(item ?? '') });
    });
  }

  return out;
}

function normalizeClientContacts(body: any): Array<{ id?: number; description: string; phone: string | null; email: string | null; isWhatsapp: boolean }> | null {
  const input = extractClientContacts(body);
  if (!input) return null;

  const out: Array<{ id?: number; description: string; phone: string | null; email: string | null; isWhatsapp: boolean }> = [];
  input.forEach((item, index) => {
    const phone = normalizePhone(String(item?.phone || '')) || null;
    const email = normalizeEmail(String(item?.email || '')) || null;
    if (!phone && !email) return;

    const id = toOptionalPositiveInt(item?.id);
    const kind = phone ? 'phone' : 'email';
    out.push({
      ...(id ? { id } : {}),
      description: buildContactDescription(kind, index, phone || email, item?.description),
      phone,
      email,
      isWhatsapp: phone ? Boolean(item?.isWhatsapp) : false,
    });
  });

  return out;
}

async function syncClientContacts(
  tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  clientId: number,
  contacts: Array<{ id?: number; description: string; phone: string | null; email: string | null; isWhatsapp: boolean }> | null,
) {
  if (contacts === null) return;

  const existing = await tx.clientContact.findMany({
    where: { clientId: Math.trunc(clientId) },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((item) => item.id));
  const incomingIds = new Set<number>();

  for (const contact of contacts) {
    if (contact.id && existingIds.has(contact.id)) {
      incomingIds.add(contact.id);
      await tx.clientContact.update({
        where: { id: contact.id },
        data: {
          description: contact.description,
          phone: contact.phone,
          email: contact.email,
          isWhatsapp: contact.phone ? contact.isWhatsapp : false,
        },
      });
      continue;
    }

    const created = await tx.clientContact.create({
      data: {
        clientId: Math.trunc(clientId),
        description: contact.description,
        phone: contact.phone,
        email: contact.email,
        isWhatsapp: contact.phone ? contact.isWhatsapp : false,
      },
      select: { id: true },
    });
    incomingIds.add(created.id);
  }

  const toDelete = existing.filter((item) => !incomingIds.has(item.id)).map((item) => item.id);
  if (toDelete.length > 0) {
    await tx.clientContact.deleteMany({
      where: {
        clientId: Math.trunc(clientId),
        id: { in: toDelete },
      },
    });
  }
}

async function computeInvoiceTotals(clientId: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const invoices = await prisma.clientInvoice.findMany({
    where: { clientId: Math.trunc(clientId) },
    select: {
      dueDate: true,
      status: true,
      totalValue: true,
    },
  });

  let titlesDue = 0;
  let titlesOverdue = 0;

  for (const inv of invoices) {
    const status = String(inv.status || '').trim().toUpperCase();
    if (status === 'PAGA') continue;
    if (!inv.dueDate) continue;

    const due = new Date(inv.dueDate);
    due.setHours(0, 0, 0, 0);
    const amount = Number(inv.totalValue || 0);
    if (!Number.isFinite(amount)) continue;

    if (due < today) titlesOverdue += amount;
    else titlesDue += amount;
  }

  return { titlesDue, titlesOverdue };
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

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }
    const client = await prisma.client.findUnique({
      where: { id: Math.trunc(id) },
      select: {
        id: true,
        clientCode: true,
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
        contacts: {
          select: {
            id: true,
            description: true,
            phone: true,
            email: true,
            isWhatsapp: true,
          },
          orderBy: [{ description: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    const totals = await computeInvoiceTotals(client.id);
    return NextResponse.json({
      ...client,
      titlesDue: totals.titlesDue,
      titlesOverdue: totals.titlesOverdue,
      paymentTermCode: client.paymentTerm?.code ?? null,
      paymentTermDescription: client.paymentTerm?.description ?? null,
      contacts: (client.contacts || []).map((contact) => ({
        id: contact.id,
        description: contact.description,
        phone: contact.phone,
        email: contact.email,
        isWhatsapp: contact.isWhatsapp,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const fields: any = {};
    if (
      body.clientCode !== undefined ||
      body.codCliente !== undefined ||
      body.cod_cliente !== undefined ||
      body.codigoCliente !== undefined ||
      body.codigo_cliente !== undefined
    ) {
      const v =
        body.clientCode ??
        body.codCliente ??
        body.cod_cliente ??
        body.codigoCliente ??
        body.codigo_cliente;
      const digits = String(v ?? '').trim().replace(/\D/g, '');
      if (!digits) fields.clientCode = null;
      else {
        const n = Number(digits);
        fields.clientCode = Number.isFinite(n) ? Math.trunc(n) : null;
      }
    }
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
    const contacts = normalizeClientContacts(body);
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
        where: { id: Math.trunc(id) },
        data,
        select: {
          id: true,
          clientCode: true,
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
          contacts: {
            select: {
              id: true,
              description: true,
              phone: true,
              email: true,
              isWhatsapp: true,
            },
            orderBy: [{ description: 'asc' }, { id: 'asc' }],
          },
        },
      });

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

      await syncClientContacts(tx, row.id, contacts);

      return row;
    });

    const totals = await computeInvoiceTotals(updated.id);
    return NextResponse.json({
      ...updated,
      titlesDue: totals.titlesDue,
      titlesOverdue: totals.titlesOverdue,
      paymentTermCode: updated.paymentTerm?.code ?? null,
      paymentTermDescription: updated.paymentTerm?.description ?? null,
      contacts: (updated.contacts || []).map((contact) => ({
        id: contact.id,
        description: contact.description,
        phone: contact.phone,
        email: contact.email,
        isWhatsapp: contact.isWhatsapp,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    await prisma.client.delete({ where: { id: Math.trunc(id) } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
