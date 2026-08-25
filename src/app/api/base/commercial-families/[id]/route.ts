import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

type ParsedOptionalInt = number | null | undefined | { error: string };

function parseOptionalInt(value: unknown): ParsedOptionalInt {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return { error: 'Informe um número inteiro válido para as medidas.' };
  return Math.trunc(parsed);
}

function isParseError(value: ParsedOptionalInt): value is { error: string } {
  return typeof value === 'object' && value !== null && 'error' in value;
}

function validateRanges(data: { widthMin?: number | null; widthMax?: number | null; lengthMin?: number | null; lengthMax?: number | null }) {
  if (data.widthMin != null && data.widthMax != null && data.widthMin > data.widthMax) {
    return 'Largura Mínima não pode ser maior que Largura Máxima.';
  }
  if (data.lengthMin != null && data.lengthMax != null && data.lengthMin > data.lengthMax) {
    return 'Comprimento Mínimo não pode ser maior que Comprimento Máximo.';
  }
  return null;
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = Number(params.id);
    const body = await request.json();
    const data: any = {};
    if (body.description !== undefined) data.description = String(body.description || '').trim();
    if (body.erpCode !== undefined) data.erpCode = body.erpCode === null ? null : String(body.erpCode).trim();
    if (body.priceBy !== undefined) data.priceBy = String(body.priceBy || '').trim().toUpperCase();
    if (body.widthMin !== undefined) data.widthMin = parseOptionalInt(body.widthMin);
    if (body.widthMax !== undefined) data.widthMax = parseOptionalInt(body.widthMax);
    if (body.lengthMin !== undefined) data.lengthMin = parseOptionalInt(body.lengthMin);
    if (body.lengthMax !== undefined) data.lengthMax = parseOptionalInt(body.lengthMax);
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    if (data.priceBy !== undefined && !['UNIT', 'WEIGHT'].includes(data.priceBy)) return NextResponse.json({ error: 'Preço Por inválido' }, { status: 400 });
    if (isParseError(data.widthMin)) return NextResponse.json(data.widthMin, { status: 400 });
    if (isParseError(data.widthMax)) return NextResponse.json(data.widthMax, { status: 400 });
    if (isParseError(data.lengthMin)) return NextResponse.json(data.lengthMin, { status: 400 });
    if (isParseError(data.lengthMax)) return NextResponse.json(data.lengthMax, { status: 400 });

    const current = await prisma.commercialFamily.findUnique({
      where: { id },
      select: { widthMin: true, widthMax: true, lengthMin: true, lengthMax: true },
    });
    if (!current) return NextResponse.json({ error: 'Família comercial não encontrada' }, { status: 404 });

    const rangeError = validateRanges({
      widthMin: data.widthMin !== undefined ? data.widthMin : current.widthMin,
      widthMax: data.widthMax !== undefined ? data.widthMax : current.widthMax,
      lengthMin: data.lengthMin !== undefined ? data.lengthMin : current.lengthMin,
      lengthMax: data.lengthMax !== undefined ? data.lengthMax : current.lengthMax,
    });
    if (rangeError) return NextResponse.json({ error: rangeError }, { status: 400 });

    const updated = await prisma.commercialFamily.update({
      where: { id },
      data,
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
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = Number(params.id);
    await prisma.commercialFamily.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
