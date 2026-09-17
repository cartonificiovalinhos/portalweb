type ClientItemDimensionCodeLookupDb = {
  clientItemDimensionCode: {
    findUnique: (args: any) => Promise<{ clientItemCode: string | null } | null>;
    upsert: (args: any) => Promise<any>;
    deleteMany: (args: any) => Promise<any>;
  };
};

export type ClientItemDimensionCodeInput = {
  customerDoc?: string | null;
  sku?: string | null;
  width?: number | null;
  length?: number | null;
  grammage?: number | null;
};

export type ClientItemDimensionCodeBatchInput = {
  customerDoc?: string | null;
  sku?: string | null;
  entries?: Array<(ClientItemDimensionCodeInput & { clientItemCode?: string | null }) | null | undefined> | null;
};

function toPositiveInt(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.trunc(numeric);
}

export function normalizeClientItemDimensionCodeInput(input: ClientItemDimensionCodeInput) {
  const customerDoc = String(input.customerDoc || '').replace(/\D+/g, '');
  const sku = String(input.sku || '').trim();
  const width = toPositiveInt(input.width);
  const length = toPositiveInt(input.length);
  const grammage = toPositiveInt(input.grammage);

  if (!customerDoc || !sku || width == null || length == null || grammage == null) {
    return null;
  }

  return { customerDoc, sku, width, length, grammage };
}

function normalizeClientItemDimensionCodeScope(input: Pick<ClientItemDimensionCodeInput, 'customerDoc' | 'sku'>) {
  const customerDoc = String(input.customerDoc || '').replace(/\D+/g, '');
  const sku = String(input.sku || '').trim();
  if (!customerDoc || !sku) return null;
  return { customerDoc, sku };
}

export async function resolveClientItemDimensionCode(
  db: ClientItemDimensionCodeLookupDb,
  input: ClientItemDimensionCodeInput,
): Promise<string | null> {
  const normalized = normalizeClientItemDimensionCodeInput(input);
  if (!normalized) return null;

  const row = await db.clientItemDimensionCode.findUnique({
    where: {
      customerDoc_sku_width_length_grammage: normalized,
    },
    select: {
      clientItemCode: true,
    },
  });

  const code = String(row?.clientItemCode || '').trim();
  return code || null;
}

export async function syncClientItemDimensionCode(
  db: ClientItemDimensionCodeLookupDb,
  input: ClientItemDimensionCodeInput & { clientItemCode?: string | null },
): Promise<void> {
  const normalized = normalizeClientItemDimensionCodeInput(input);
  if (!normalized) return;

  const clientItemCode = String(input.clientItemCode || '').trim();
  if (!clientItemCode) {
    await db.clientItemDimensionCode.deleteMany({
      where: normalized,
    });
    return;
  }

  await db.clientItemDimensionCode.upsert({
    where: {
      customerDoc_sku_width_length_grammage: normalized,
    },
    update: {
      clientItemCode,
    },
    create: {
      ...normalized,
      clientItemCode,
    },
  });
}

export async function replaceClientItemDimensionCodes(
  db: ClientItemDimensionCodeLookupDb,
  input: ClientItemDimensionCodeBatchInput,
): Promise<void> {
  const scope = normalizeClientItemDimensionCodeScope(input);
  if (!scope) return;

  await db.clientItemDimensionCode.deleteMany({
    where: scope,
  });

  const entries = Array.isArray(input.entries) ? input.entries : [];
  for (const entry of entries) {
    await syncClientItemDimensionCode(db, {
      customerDoc: scope.customerDoc,
      sku: String(entry?.sku || scope.sku).trim() || scope.sku,
      width: entry?.width,
      length: entry?.length,
      grammage: entry?.grammage,
      clientItemCode: entry?.clientItemCode,
    });
  }
}
