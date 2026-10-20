import type { CatalogProduct } from "../catalog/api/catalog";
import type { PollCategory } from "../../constants/poll-categories";

export type TrendPeriod = "DAY" | "WEEK" | "MONTH";
export type TrendVoter = "ANY" | "WOMAN" | "MAN" | "NON_BINARY" | "UNSPECIFIED";
export type TrendAge = "ANY" | "AGE_18_24" | "AGE_25_34" | "AGE_35_PLUS";
export type TrendCurrency = "TRY" | "EUR" | "USD" | "GBP";
export type PriceBand = "ALL" | "UNDER_750" | "FROM_750_TO_2000" | "OVER_2000";
export type TrendFilters = {
  period: TrendPeriod;
  category: "ALL" | PollCategory;
  voter: TrendVoter;
  age: TrendAge;
  brand: string;
  price: PriceBand;
  currency: TrendCurrency;
};
export const DEFAULT_TREND_FILTERS: TrendFilters = {
  period: "WEEK",
  category: "ALL",
  voter: "ANY",
  age: "ANY",
  brand: "",
  price: "ALL",
  currency: "TRY",
};
export type TrendItem = {
  id: string;
  rank: number;
  score: number;
  distinctVoters: number;
  latestSignalAt: string;
  product: CatalogProduct;
};
export type TrendsPage = {
  status: "READY" | "NO_DATA" | "INSUFFICIENT_SAMPLE";
  items: TrendItem[];
  nextCursor: string | null;
  period: {
    period: TrendPeriod;
    anchorDate: string;
    startDate: string;
    endDate: string;
    startsAt: string;
    endsAt: string;
    timeZone: "Europe/Istanbul";
  };
  filters: {
    category: PollCategory | null;
    brand: string | null;
    gender: Exclude<TrendVoter, "ANY"> | null;
    ageBand: Exclude<TrendAge, "ANY"> | null;
    currency: TrendCurrency;
    minPriceMinor: number | null;
    maxPriceMinor: number | null;
  };
  population: "CONSENTED_VOTER_SNAPSHOT" | "GENERAL_PREFERENCES";
  policy: {
    version: number;
    measurement: "PRODUCTS_IN_PREFERRED_OUTFITS";
    timeZone: "Europe/Istanbul";
    day: "CALENDAR";
    weekStartsOn: "MONDAY";
    month: "CALENDAR";
    score: "FIRST_ELIGIBLE_VOTE_PER_VOTER_PRODUCT_DAY";
    minimumDistinctVoters: number;
  };
  priceBasis: "PUBLICATION_SNAPSHOT";
  productBasis: "CURRENT_CATALOG";
  consistency: "EVENTUAL";
  asOf: string;
  computedAt: string;
};
