import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

type ParsedOptionalInt = number | null | { error: string };

function parseOptionalInt(value: unknown): ParsedOptionalInt {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return { error: 'Informe um número inteiro válido para as medidas.' };
  return Math.trunc(parsed);
}

function isParseError(value: ParsedOptionalInt): value is { error: string } {
  return typeof value === 'object' && value !== null && 'error' in value;
}

function validateRanges(data: { widthMin: number | null; widthMax: number | null; lengthMin: number | null; lengthMax: number | null }) {
  if (data.widthMin !== null && data.widthMax !== null && data.widthMin > data.widthMax) {
    return 'Largura Mínima não pode ser maior que Largura Máxima.';
  }
  if (data.lengthMin !== null && data.lengthMax !== null && data.lengthMin > data.lengthMax) {
    return 'Comprimento Mínimo não pode ser maior que Comprimento Máximo.';
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();

    const rows = await prisma.commercialFamily.findMany({
      where: q ? { description: { contains: q } } : undefined,
      orderBy: { description: 'asc' },
      select: {
        id: true,
        description: true,
        erpCode: true,
        priceBy: true,
        widthMin: true,
        widthMax: true,
        lengthMin: true,
        lengthMax: true,
      },
    });

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const description = String(body.description || '').trim();
    const erpCodeRaw = body.erpCode;
    const erpCode = erpCodeRaw === undefined || erpCodeRaw === null ? null : String(erpCodeRaw).trim();
    const priceByRaw = body.priceBy;
    const priceBy = (priceByRaw === undefined || priceByRaw === null ? 'UNIT' : String(priceByRaw).trim().toUpperCase()) || 'UNIT';
    const widthMin = parseOptionalInt(body.widthMin);
    const widthMax = parseOptionalInt(body.widthMax);
    const lengthMin = parseOptionalInt(body.lengthMin);
    const lengthMax = parseOptionalInt(body.lengthMax);
    if (!description) return NextResponse.json({ error: 'Descrição é obrigatória' }, { status: 400 });
    if (!['UNIT', 'WEIGHT'].includes(priceBy)) return NextResponse.json({ error: 'Preço Por inválido' }, { status: 400 });
    if (isParseError(widthMin)) return NextResponse.json(widthMin, { status: 400 });
    if (isParseError(widthMax)) return NextResponse.json(widthMax, { status: 400 });
    if (isParseError(lengthMin)) return NextResponse.json(lengthMin, { status: 400 });
    if (isParseError(lengthMax)) return NextResponse.json(lengthMax, { status: 400 });

    const rangeError = validateRanges({
      widthMin,
      widthMax,
      lengthMin,
      lengthMax,
    });
    if (rangeError) return NextResponse.json({ error: rangeError }, { status: 400 });

    const created = await prisma.commercialFamily.create({
      data: { description, erpCode, priceBy, widthMin, widthMax, lengthMin, lengthMax },
      select: {
        id: true,
        description: true,
        erpCode: true,
        priceBy: true,
        widthMin: true,
        widthMax: true,
        lengthMin: true,
        lengthMax: true,
      },
    });
    return NextResponse.json(created);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
