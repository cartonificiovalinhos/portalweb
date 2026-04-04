import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const workOrderId = Number(params.id);
  const items = await prisma.attachment.findMany({ where: { workOrderId }, orderBy: { uploadedAt: 'desc' } });
  return NextResponse.json(items);
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const workOrderId = Number(params.id);
  const body = await request.json();
  const { fileName, url, mimeType } = body;
  if (!fileName || !url) {
    return NextResponse.json({ error: 'fileName e url são obrigatórios' }, { status: 400 });
  }
  const created = await prisma.attachment.create({
    data: { fileName, url, mimeType, workOrderId }
  });
  return NextResponse.json(created, { status: 201 });
}