import { useState } from "react";
import type { PollCategory } from "@/constants/poll-categories";
import {
  trendProducts,
  TREND_LIMIT,
  TREND_MIN_PICKS,
} from "../data/demo-products";
import type { PriceBand, TrendPeriod, TrendVoter } from "../types";

function inPriceBand(priceMinor: number, band: PriceBand) {
  if (band === "UNDER_750") return priceMinor < 75000;
  if (band === "FROM_750_TO_2000")
    return priceMinor >= 75000 && priceMinor <= 200000;
  if (band === "OVER_2000") return priceMinor > 200000;
  return true;
}

export function useTrends() {
  const [period, setPeriod] = useState<TrendPeriod>("WEEK");
  const [category, setCategory] = useState<"ALL" | PollCategory>("ALL");
  const [voter, setVoter] = useState<TrendVoter>("ANY");
  const [price, setPrice] = useState<PriceBand>("ALL");
  // Dönem her zaman seçilidir; diğer üçü varsayılandan farklıysa sayılır.
  const activeCount =
    (category === "ALL" ? 0 : 1) +
    (voter === "ANY" ? 0 : 1) +
    (price === "ALL" ? 0 : 1);
  const rows = trendProducts
    .filter((product) => category === "ALL" || product.category === category)
    .filter((product) => inPriceBand(product.priceMinor, price))
    .map((product) => ({ product, picks: product.picks[period][voter] }))
    .filter((row) => row.picks >= TREND_MIN_PICKS)
    .sort((a, b) => b.picks - a.picks)
    .slice(0, TREND_LIMIT);
  function reset() {
    setCategory("ALL");
    setVoter("ANY");
    setPrice("ALL");
  }
  return {
    period,
    setPeriod,
    category,
    setCategory,
    voter,
    setVoter,
    price,
    setPrice,
    rows,
    activeCount,
    reset,
  };
}
