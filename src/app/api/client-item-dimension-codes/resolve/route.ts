import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveClientItemDimensionCode } from '@/lib/client-item-dimension-code';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const customerDoc = url.searchParams.get('customerDoc');
    const sku = url.searchParams.get('sku');
    const width = url.searchParams.get('width');
    const length = url.searchParams.get('length');
    const grammage = url.searchParams.get('grammage');

    const clientItemCode = await resolveClientItemDimensionCode(prisma, {
      customerDoc,
      sku,
      width: width != null ? Number(width) : null,
      length: length != null ? Number(length) : null,
      grammage: grammage != null ? Number(grammage) : null,
    });

    return NextResponse.json({ clientItemCode });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
