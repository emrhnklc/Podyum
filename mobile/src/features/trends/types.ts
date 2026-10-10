import type { DemoProduct } from "@/features/polls/types";

export type TrendPeriod = "WEEK" | "MONTH";
export type TrendVoter = "ANY" | "WOMEN" | "MEN";
export type PriceBand = "ALL" | "UNDER_750" | "FROM_750_TO_2000" | "OVER_2000";

export type TrendProduct = DemoProduct & {
  // Kaç farklı kombin seçeneğinde etiketlendiği.
  optionCount: number;
  // Dönem → tercih yapan grup → ürünün yer aldığı seçeneklere verilen oy.
  picks: Record<TrendPeriod, Record<TrendVoter, number>>;
};
