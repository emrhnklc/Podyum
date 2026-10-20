import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { ApiError } from "../../common/errors/api-error.js";
import { TrendsQueryDto } from "./dto/trends.dto.js";
import { TREND_POLICY } from "./trend-policy.js";
import { decodeTrendPage, encodeTrendPage } from "./trend-page-cursor.js";
import { trendPeriod } from "./trend-period.js";
import type { TrendItemDto } from "./dto/trends-response.dto.js";
import { trendRankingQuery } from "./trend-ranking.query.js";

@Injectable()
export class TrendsService {
  constructor(private readonly db: PrismaService) {}

  async list(userId: string, query: TrendsQueryDto) {
    if (
      query.minPriceMinor !== undefined &&
      query.maxPriceMinor !== undefined &&
      query.minPriceMinor > query.maxPriceMinor
    ) {
      throw new ApiError(
        400,
        "INVALID_PRICE_RANGE",
        "En düşük fiyat, en yüksek fiyattan büyük olamaz.",
      );
    }
    const [{ now }] = await this.db.$queryRaw<
      { now: Date }[]
    >`SELECT clock_timestamp() AS "now"`;
    const filters = {
      category: query.category ?? null,
      brand: query.brand ?? null,
      gender: query.gender ?? null,
      ageBand: query.ageBand ?? null,
      currency: query.currency,
      minPriceMinor: query.minPriceMinor ?? null,
      maxPriceMinor: query.maxPriceMinor ?? null,
    };
    const context = {
      userId,
      period: query.period,
      date: query.date ?? null,
      ...filters,
      policy: TREND_POLICY.version,
    };
    const after = query.cursor
      ? decodeTrendPage(query.cursor, context, now)
      : null;
    const asOf = after ? new Date(after.asOf) : now;
    const range = trendPeriod(query.period, query.date, asOf);
    const [result] = await this.db.$queryRaw<
      {
        items: TrendItemDto[];
        hasSignals: boolean;
        hasQualified: boolean;
        fingerprint: string;
      }[]
    >(trendRankingQuery(query, range, asOf, after));
    if (after && result.fingerprint !== after.fingerprint)
      throw new ApiError(
        409,
        "TREND_RESULTS_CHANGED",
        "Trend verisi veya izinler değişti; listeyi yenile.",
      );
    const items = result.items.slice(0, query.limit),
      last = items.at(-1);
    return {
      status: result.hasQualified
        ? "READY"
        : result.hasSignals
          ? "INSUFFICIENT_SAMPLE"
          : "NO_DATA",
      items,
      nextCursor:
        result.items.length > query.limit && last
          ? encodeTrendPage(
              {
                asOf: asOf.toISOString(),
                fingerprint: result.fingerprint,
                id: last.id,
                score: last.score,
                distinctVoters: last.distinctVoters,
              },
              context,
            )
          : null,
      period: {
        ...range,
        startsAt: range.startsAt.toISOString(),
        endsAt: range.endsAt.toISOString(),
        timeZone: TREND_POLICY.timeZone,
      },
      filters,
      population:
        query.gender || query.ageBand
          ? "CONSENTED_VOTER_SNAPSHOT"
          : "GENERAL_PREFERENCES",
      policy: TREND_POLICY,
      priceBasis: "PUBLICATION_SNAPSHOT",
      productBasis: "CURRENT_CATALOG",
      consistency: "EVENTUAL",
      asOf: asOf.toISOString(),
      computedAt: now.toISOString(),
    };
  }
}
