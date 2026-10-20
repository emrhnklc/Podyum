import type { TrendFilters } from "../types";

export function trendsPath(
  filters: TrendFilters,
  cursor?: string,
): `/${string}` {
  const query = new URLSearchParams({
    period: filters.period,
    currency: filters.currency,
    limit: "20",
  });
  if (filters.category !== "ALL") query.set("category", filters.category);
  if (filters.voter !== "ANY") query.set("gender", filters.voter);
  if (filters.age !== "ANY") query.set("ageBand", filters.age);
  if (filters.brand.trim()) query.set("brand", filters.brand.trim());
  if (filters.price === "UNDER_750") query.set("maxPriceMinor", "74999");
  if (filters.price === "FROM_750_TO_2000") {
    query.set("minPriceMinor", "75000");
    query.set("maxPriceMinor", "200000");
  }
  if (filters.price === "OVER_2000") query.set("minPriceMinor", "200001");
  if (cursor) query.set("cursor", cursor);
  return `/trends?${query}`;
}
