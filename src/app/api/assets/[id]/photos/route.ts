import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const assetId = Number(params.id);
  const items = await prisma.assetAttachment.findMany({ where: { assetId }, orderBy: { uploadedAt: 'desc' } });
  // Opcional: filtrar somente imagens via query (?images=1 ou ?onlyImages=1)
  try {
    const url = new URL(_.url);
    const onlyImages = url.searchParams.get('images') || url.searchParams.get('onlyImages');
    if (onlyImages) {
      const filtered = items.filter((p: any) => {
        const mt = (p?.mimeType || '').toLowerCase();
        const urlStr = String(p?.url || '');
        return (mt && mt.startsWith('image')) || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(urlStr);
      });
      return NextResponse.json(filtered);
    }
  } catch {}
  return NextResponse.json(items);
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const assetId = Number(params.id);
  const ct = request.headers.get('content-type') || '';

  // Suporta multipart/form-data (upload direto de arquivo)
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });
    }
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const safeName = (file.name || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalName = `asset-${assetId}-${Date.now()}-${randomUUID()}-${safeName}`;
    const filePath = path.join(uploadsDir, finalName);
    fs.writeFileSync(filePath, buffer);
    const url = `/uploads/${finalName}`;

    const created = await prisma.assetAttachment.create({
      data: { fileName: finalName, url, mimeType: file.type || null, assetId }
    });
    return NextResponse.json(created, { status: 201 });
  }

  // Fallback: JSON com { fileName, url, mimeType }
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Formato não suportado. Envie multipart/form-data ou JSON.' }, { status: 400 });
  }
  const { fileName, url, mimeType } = body as any;
  if (!fileName || !url) {
    return NextResponse.json({ error: 'fileName e url são obrigatórios' }, { status: 400 });
  }
  const created = await prisma.assetAttachment.create({
    data: { fileName, url, mimeType: mimeType || null, assetId }
  });
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const assetId = Number(params.id);
  let photoId: number | null = null;
  try {
    const urlObj = new URL(request.url);
    const idParam = urlObj.searchParams.get('id') || urlObj.searchParams.get('photoId');
    if (idParam) photoId = Number(idParam);
  } catch {}
  if (!photoId) {
    const body = await request.json().catch(() => null);
    if (body && body.id) photoId = Number(body.id);
  }
  if (!photoId || Number.isNaN(photoId)) {
    return NextResponse.json({ error: 'Parâmetro id da foto é obrigatório' }, { status: 400 });
  }

  const photo = await prisma.assetAttachment.findUnique({ where: { id: photoId } });
  if (!photo) return NextResponse.json({ error: 'Foto não encontrada' }, { status: 404 });
  if (photo.assetId !== assetId) {
    return NextResponse.json({ error: 'Foto não pertence a este ativo' }, { status: 400 });
  }

  // Remover arquivo físico se estiver em /public/uploads
  if (photo.url?.startsWith('/uploads/')) {
    const filePath = path.join(process.cwd(), 'public', photo.url.replace(/^\//, ''));
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // Continua mesmo se não conseguir apagar o arquivo
    }
  }

  await prisma.assetAttachment.delete({ where: { id: photoId } });
  return NextResponse.json({ ok: true });
}
