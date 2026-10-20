import type { PollCategory } from "@/constants/poll-categories";

export type CatalogProduct = {
  id: string;
  title: string;
  brand: string | null;
  category: PollCategory;
  canonicalUrl: string | null;
  version: number;
  priceMinor: number | null;
  currency: string;
  priceRecordedAt: string | null;
  store: { id: string; name: string; domain: string } | null;
};

export type CatalogResolution = {
  match: "EXACT" | "CANDIDATES" | "UNMATCHED";
  product: CatalogProduct | null;
  candidates: CatalogProduct[];
  originalUrl: string | null;
  normalizedUrl: string | null;
};
