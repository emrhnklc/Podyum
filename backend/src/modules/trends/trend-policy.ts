export const TREND_POLICY = {
  version: 1,
  measurement: "PRODUCTS_IN_PREFERRED_OUTFITS",
  timeZone: "Europe/Istanbul",
  day: "CALENDAR",
  weekStartsOn: "MONDAY",
  month: "CALENDAR",
  score: "FIRST_ELIGIBLE_VOTE_PER_VOTER_PRODUCT_DAY",
  minimumDistinctVoters: 5,
} as const;
