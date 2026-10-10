import type { PollCategory } from "@/constants/poll-categories";

export type TrendPeriod = "WEEK" | "MONTH";
export type TrendVoter = "ANY" | "WOMEN" | "MEN";
export type PriceBand = "ALL" | "UNDER_750" | "FROM_750_TO_2000" | "OVER_2000";

export type TrendProduct = {
  id: string;
  title: string;
  brand: string;
  category: PollCategory;
  priceMinor: number;
  tone: string;
  image?: string;
  // Dönem → tercih yapan grubu → seçilme sayısı ve önceki döneme göre sıra farkı.
  picks: Record<TrendPeriod, Record<TrendVoter, number>>;
  rankChange: Record<TrendPeriod, number | "NEW">;
};
