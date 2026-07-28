import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../../lib/prisma';

function normalizeDoc(doc: string): string {
  return (doc || '').replace(/\D+/g, '');
}

function parseDate(raw: any): Date | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const iso = new Date(s);
  if (Number.isFinite(iso.getTime())) return iso;

  const m = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 1900 && yyyy <= 3000) {
      const d = new Date(yyyy, mm - 1, dd);
      if (Number.isFinite(d.getTime())) return d;
    }
  }

  return null;
}

function parseStatus(raw: any): 'EM_ABERTO' | 'PAGA' {
  const s = String(raw || '').trim().toUpperCase();
  return s === 'PAGA' ? 'PAGA' : 'EM_ABERTO';
}

function parseAmount(raw: any): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const s = String(raw).trim();
  if (!s) return 0;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  let normalized = s;

  if (hasDot && hasComma) {
    // Usa o ultimo separador como decimal e remove o outro como milhar.
    normalized = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (hasComma) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (hasDot) {
    const parts = s.split('.');
    normalized = parts.length === 2 && parts[1].length <= 2
      ? s
      : s.replace(/\./g, '');
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export async function PUT(request: Request, props: { params: Promise<{ doc: string }> }) {
  const params = await props.params;
  try {
    const doc = normalizeDoc(params.doc ?? '');
    if (!doc) return NextResponse.json({ error: 'doc inválido' }, { status: 400 });

    const client = await prisma.client.findFirst({ where: { doc }, select: { id: true } });
    if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });

    const body = await request.json().catch(() => null);
    const list = Array.isArray(body) ? body : (Array.isArray((body as any)?.invoices) ? (body as any).invoices : []);
    if (!Array.isArray(list)) return NextResponse.json({ error: 'invoices inválido' }, { status: 400 });

    const invoices = list
      .map((it: any) => {
        const invoiceNumber = String(it?.invoiceNumber ?? it?.numFatura ?? it?.numero ?? it?.num ?? '').trim();
        if (!invoiceNumber) return null;
        const issueDate = parseDate(it?.issueDate ?? it?.dataEmissao ?? it?.emissao);
        if (!issueDate) return null;
        const dueDate = parseDate(it?.dueDate ?? it?.dataVencimento ?? it?.vencimento);
        const totalValue = parseAmount(it?.totalValue ?? it?.valor ?? it?.valorTotal ?? it?.valorR$);
        const status = parseStatus(it?.status ?? it?.situacao);
        return {
          clientId: client.id,
          invoiceNumber,
          issueDate,
          dueDate,
          totalValue,
          status,
        };
      })
      .filter(Boolean) as any[];

    await prisma.$transaction(async (tx) => {
      await tx.clientInvoice.deleteMany({ where: { clientId: client.id } });
      if (invoices.length > 0) {
        await tx.clientInvoice.createMany({ data: invoices, skipDuplicates: true });
      }
    });

    return NextResponse.json({ ok: true, clientId: client.id, count: invoices.length });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
