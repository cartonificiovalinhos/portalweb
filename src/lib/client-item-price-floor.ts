type PriceRow = { unit: string; unitPrice: number };
type ClientLinkRow = { inventoryItemId: number; unit: string | null; unitPrice: number | null; manual: boolean };

export type ClientItemPriceFloorInfo = {
  clientUnitPrice: number | null;
  basePrice: number | null;
  minAllowedPrice: number | null;
  manual: boolean;
};

function normalizeUnit(unit?: string | null): string {
  return String(unit || '').trim().toUpperCase();
}

function toPositiveNumber(value: unknown): number | null {
  const num = Number(value ?? 0);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export async function buildClientItemPriceFloorResolver(
  db: any,
  clientId: number,
  inventoryItemIds: number[],
) {
  const ids = Array.from(new Set(inventoryItemIds.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n) && n > 0)));
  if (!Number.isFinite(clientId) || clientId <= 0 || ids.length === 0) {
    return () => ({ clientUnitPrice: null, basePrice: null, minAllowedPrice: null, manual: false });
  }

  const clientLinks = await db.clientItem.findMany({
    where: { clientId: Math.trunc(clientId), inventoryItemId: { in: ids }, allowed: true },
    select: { inventoryItemId: true, unit: true, unitPrice: true, manual: true },
  });

  const linkByInventoryItemId = new Map<number, ClientLinkRow>();
  for (const link of clientLinks as ClientLinkRow[]) {
    linkByInventoryItemId.set(Math.trunc(Number(link.inventoryItemId)), link);
  }

  const repLinks = await db.userClientRep.findMany({
    where: { clientId: Math.trunc(clientId) },
    select: { userId: true },
    orderBy: { id: 'asc' },
  });
  const repUserIds = Array.from(new Set(repLinks.map((x: any) => Number(x.userId)).filter((x: number) => Number.isFinite(x) && x > 0)));

  const rowsByRepAndItem = new Map<string, PriceRow[]>();
  if (repUserIds.length > 0) {
    const prices = await db.userInventoryItemPrice.findMany({
      where: {
        userId: { in: repUserIds },
        inventoryItemId: { in: ids },
      },
      select: { userId: true, inventoryItemId: true, unit: true, unitPrice: true },
    });

    for (const row of prices as any[]) {
      const key = `${Number(row.userId)}::${Number(row.inventoryItemId)}`;
      const list = rowsByRepAndItem.get(key) || [];
      list.push({
        unit: normalizeUnit(row.unit),
        unitPrice: Number(row.unitPrice ?? 0),
      });
      rowsByRepAndItem.set(key, list);
    }
  }

  return (inventoryItemId: number, unit?: string | null): ClientItemPriceFloorInfo => {
    const normalizedInventoryItemId = Math.trunc(Number(inventoryItemId));
    const link = linkByInventoryItemId.get(normalizedInventoryItemId);
    const unitNorm = normalizeUnit(unit) || normalizeUnit(link?.unit);

    let basePrice: number | null = null;
    for (const repUserId of repUserIds) {
      const rows = rowsByRepAndItem.get(`${repUserId}::${normalizedInventoryItemId}`) || [];
      if (!rows.length) continue;

      if (unitNorm) {
        const exact = rows.find((row) => row.unit === unitNorm);
        const exactValue = toPositiveNumber(exact?.unitPrice);
        if (exactValue != null) {
          basePrice = exactValue;
          break;
        }
      }

      const uniquePrices = Array.from(
        new Set(
          rows
            .map((row) => toPositiveNumber(row.unitPrice))
            .filter((value): value is number => value != null),
        ),
      );
      if (uniquePrices.length === 1) {
        basePrice = uniquePrices[0];
        break;
      }
    }

    const clientUnitPrice = link ? Number(link.unitPrice ?? 0) : null;
    const positiveClientUnitPrice = toPositiveNumber(clientUnitPrice);
    const minAllowedPrice = [positiveClientUnitPrice, basePrice].reduce<number | null>((max, current) => {
      if (current == null) return max;
      if (max == null) return current;
      return current > max ? current : max;
    }, null);

    return {
      clientUnitPrice,
      basePrice,
      minAllowedPrice,
      manual: Boolean(link?.manual),
    };
  };
}
