type InventoryItemWriteDb = {
  commercialFamily: {
    findUnique: (args: any) => Promise<{ id: number } | null>;
    findFirst: (args: any) => Promise<{ id: number } | null>;
  };
};

function parseOptionalBoolean(input: unknown): boolean | undefined {
  if (input === undefined) return undefined;
  if (input === null) return false;
  if (typeof input === 'boolean') return input;
  if (typeof input === 'number') return input !== 0;

  const raw = String(input).trim().toLowerCase();
  if (!raw) return false;
  if (['true', '1', 'sim', 's', 'yes', 'y'].includes(raw)) return true;
  if (['false', '0', 'nao', 'não', 'n', 'no'].includes(raw)) return false;
  return Boolean(raw);
}

async function resolveCommercialFamilyId(
  db: InventoryItemWriteDb,
  input: unknown,
): Promise<number | null> {
  if (input === undefined) return null;
  if (input === null) return null;

  const raw = String(input).trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const cfid = Number(raw);
    if (Number.isFinite(cfid) && cfid > 0) {
      const cf = await db.commercialFamily.findUnique({ where: { id: cfid }, select: { id: true } });
      return cf ? cfid : null;
    }
  }

  const byDescription = await db.commercialFamily.findFirst({
    where: {
      OR: [
        { description: { equals: raw } },
        { erpCode: { equals: raw } },
      ],
    },
    select: { id: true },
  });
  return byDescription ? Number(byDescription.id) : null;
}

export async function buildInventoryItemPatchData(
  db: InventoryItemWriteDb,
  body: any,
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = String(body.name || '').trim();
  if (body.sku !== undefined) data.sku = String(body.sku || '').trim();
  if (body.unit !== undefined) data.unit = String(body.unit || '').trim();
  if (body.active !== undefined) data.active = parseOptionalBoolean(body.active);
  if (body.width !== undefined) data.width = body.width === null || body.width === '' ? null : Number(body.width);
  if (body.length !== undefined) data.length = body.length === null || body.length === '' ? null : Number(body.length);
  if (body.grammage !== undefined) data.grammage = body.grammage === null || body.grammage === '' ? null : Number(body.grammage);

  if (body.commercialFamilyId !== undefined) {
    data.commercialFamilyId = await resolveCommercialFamilyId(db, body.commercialFamilyId);
  }

  return data;
}

export async function resolveInventoryItemLookupSku(
  body: any,
  requestUrl?: string,
): Promise<string> {
  const urlSku = requestUrl ? new URL(requestUrl).searchParams.get('sku') : null;
  const lookupSku = body?.currentSku ?? body?.lookupSku ?? body?.matchSku ?? urlSku ?? body?.sku ?? '';
  return String(lookupSku || '').trim();
}
