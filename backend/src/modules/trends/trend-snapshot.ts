import { PollCategory } from "../../generated/prisma/enums.js";
import type { Prisma } from "../../generated/prisma/client.js";

const isoDate = (value: unknown) =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

// Yayın anında doğrulanmış katalog bağlamı olmadan isimden/bugünkü fiyattan
// geçmiş veri üretmeyiz. Özgün/affiliate URL trend kaydına alınmaz.
export function trendSnapshot(
  value: Prisma.JsonValue,
  productId: string,
  publishedAt: Date,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    row.schemaVersion !== 1 ||
    row.id !== productId ||
    row.capturedAt !== publishedAt.toISOString() ||
    !Number.isSafeInteger(row.version) ||
    Number(row.version) < 0 ||
    Number(row.version) > 2147483647 ||
    !Object.values(PollCategory).includes(row.category as PollCategory) ||
    !(
      row.brand === null ||
      (typeof row.brand === "string" &&
        row.brand.length <= 100 &&
        !row.brand.includes("\u0000"))
    ) ||
    typeof row.currency !== "string" ||
    !/^[A-Z]{3}$/.test(row.currency) ||
    typeof row.source !== "string" ||
    !/^[A-Z_]{1,30}$/.test(row.source) ||
    !(
      row.priceMinor === null ||
      (Number.isSafeInteger(row.priceMinor) &&
        Number(row.priceMinor) >= 0 &&
        Number(row.priceMinor) <= 2147483647)
    ) ||
    (row.priceMinor === null
      ? row.priceRecordedAt !== null
      : !isoDate(row.priceRecordedAt))
  )
    return null;
  return {
    category: row.category as PollCategory,
    brand: row.brand as string | null,
    priceMinor: row.priceMinor as number | null,
    currency: row.currency,
    priceRecordedAt:
      row.priceRecordedAt === null
        ? null
        : new Date(row.priceRecordedAt as string),
    catalogVersion: row.version as number,
    catalogSource: row.source,
  };
}
