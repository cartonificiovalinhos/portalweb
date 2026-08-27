import { inferCommercialFamilyKey, type CommercialFamilyDimensionLimits, type OrderItemWithDimensionLimits } from "@/lib/order-item-dimension-limits";

type CommercialFamilyDb = {
  commercialFamily: {
    findMany: (args: any) => Promise<Array<CommercialFamilyDimensionLimits & { id: number; erpCode?: string | null }>>;
  };
};

function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function directFamily(item: OrderItemWithDimensionLimits): CommercialFamilyDimensionLimits | null {
  return item.inventoryItem?.commercialFamily ?? null;
}

export async function attachResolvedCommercialFamilies<T extends OrderItemWithDimensionLimits>(
  db: CommercialFamilyDb,
  items: T[],
): Promise<T[]> {
  const pendingKeys = Array.from(
    new Set(
      items
        .filter((item) => !directFamily(item))
        .map((item) => inferCommercialFamilyKey(item))
        .filter((key): key is string => Boolean(key))
    )
  );

  if (pendingKeys.length === 0) return items;

  const families = await db.commercialFamily.findMany({
    where: {
      OR: [
        { description: { in: pendingKeys } },
        { erpCode: { in: pendingKeys } },
      ],
    },
    select: {
      id: true,
      description: true,
      erpCode: true,
      widthMin: true,
      widthMax: true,
      lengthMin: true,
      lengthMax: true,
    },
  });

  const familyByKey = new Map<string, CommercialFamilyDimensionLimits>();
  for (const family of families) {
    const descriptionKey = normalizeKey(family.description);
    const erpCodeKey = normalizeKey(family.erpCode);
    if (descriptionKey) familyByKey.set(descriptionKey, family);
    if (erpCodeKey) familyByKey.set(erpCodeKey, family);
  }

  return items.map((item) => {
    if (directFamily(item)) return item;
    const inferredKey = inferCommercialFamilyKey(item);
    if (!inferredKey) return item;
    const family = familyByKey.get(inferredKey);
    if (!family) return item;
    return {
      ...item,
      inventoryItem: {
        ...(item.inventoryItem ?? {}),
        commercialFamily: family,
      },
    };
  });
}

export async function resolveCommercialFamilyForItem<T extends OrderItemWithDimensionLimits>(
  db: CommercialFamilyDb,
  item: T,
): Promise<T> {
  const [resolved] = await attachResolvedCommercialFamilies(db, [item]);
  return resolved;
}
