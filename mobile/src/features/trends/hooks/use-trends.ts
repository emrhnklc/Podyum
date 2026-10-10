import { useState } from "react";
import type { PollCategory } from "@/constants/poll-categories";
import { trendProducts, TREND_MIN_PICKS } from "../data/demo-products";
import type { PriceBand, TrendPeriod, TrendVoter } from "../types";

export function useTrends() {
  const [period, setPeriod] = useState<TrendPeriod>("WEEK");
  const [category, setCategory] = useState<"ALL" | PollCategory>("ALL");
  const [voter, setVoter] = useState<TrendVoter>("ANY");
  const [price, setPrice] = useState<PriceBand>("ALL");
  const isGeneralList =
    category === "ALL" && voter === "ANY" && price === "ALL";
  const rows = trendProducts
    .filter((product) => category === "ALL" || product.category === category)
    .filter(
      (product) =>
        price === "ALL" ||
        (price === "UNDER_750"
          ? product.priceMinor < 75000
          : price === "FROM_750_TO_2000"
            ? product.priceMinor >= 75000 && product.priceMinor <= 200000
            : product.priceMinor > 200000),
    )
    .map((product) => ({ product, picks: product.picks[period][voter] }))
    .filter((row) => row.picks >= TREND_MIN_PICKS)
    .sort((a, b) => b.picks - a.picks);
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
    isGeneralList,
  };
}
