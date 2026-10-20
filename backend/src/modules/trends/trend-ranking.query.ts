import { Prisma } from "../../generated/prisma/client.js";
import type { TrendsQueryDto } from "./dto/trends.dto.js";
import type { TrendPagePosition } from "./trend-page-cursor.js";
import type { trendPeriod } from "./trend-period.js";
import { TREND_POLICY } from "./trend-policy.js";

export function trendRankingQuery(
  query: TrendsQueryDto,
  range: ReturnType<typeof trendPeriod>,
  asOf: Date,
  after: TrendPagePosition | null,
) {
  // Filtreler günlük ilk uygun sinyal seçildikten SONRA uygulanır. Özellikle
  // sonradan izin verilmiş bir oy, izinsiz ilk oyun yerine geçirilmez.
  const conditions = [
    Prisma.sql`s."trendDay" >= ${range.startDate}::date`,
    Prisma.sql`s."trendDay" < ${range.endDate}::date`,
    Prisma.sql`s."votedAt" <= ${asOf}`,
    Prisma.sql`s."currency" = ${query.currency}`,
    ...(query.category
      ? [Prisma.sql`s."category"::text = ${query.category}`]
      : []),
    ...(query.brand ? [Prisma.sql`s."brand" = ${query.brand}`] : []),
    ...(query.gender
      ? [Prisma.sql`s."genderAtVote"::text = ${query.gender}`]
      : []),
    ...(query.ageBand
      ? [Prisma.sql`s."ageBandAtVote"::text = ${query.ageBand}`]
      : []),
    ...(query.minPriceMinor !== undefined
      ? [Prisma.sql`s."priceMinor" >= ${query.minPriceMinor}`]
      : []),
    ...(query.maxPriceMinor !== undefined
      ? [Prisma.sql`s."priceMinor" <= ${query.maxPriceMinor}`]
      : []),
  ];
  const position = after
    ? Prisma.sql`WHERE score < ${after.score}
    OR (score = ${after.score} AND "distinctVoters" < ${after.distinctVoters})
    OR (score = ${after.score} AND "distinctVoters" = ${after.distinctVoters} AND id > ${after.id}::uuid)`
    : Prisma.empty;
  return Prisma.sql`
    WITH matched AS MATERIALIZED (
      SELECT s.* FROM "TrendDailySignal" s WHERE ${Prisma.join(conditions, " AND ")}
    ), qualified AS (
      SELECT "catalogProductId" AS id, count(*)::integer AS score,
        count(DISTINCT "voterId")::integer AS "distinctVoters", max("votedAt") AS "latestSignalAt"
      FROM matched GROUP BY "catalogProductId"
      HAVING count(DISTINCT "voterId") >= ${TREND_POLICY.minimumDistinctVoters}
    ), ranked AS MATERIALIZED (
      SELECT q.*, (row_number() OVER (ORDER BY q.score DESC, q."distinctVoters" DESC, q.id))::integer AS rank,
        jsonb_build_object('id', p.id, 'title', p.title, 'brand', p.brand, 'category', p.category,
          'canonicalUrl', p."canonicalUrl", 'priceMinor', p."priceMinor", 'currency', p.currency,
          'priceRecordedAt', p."priceRecordedAt", 'version', p.version,
          'store', CASE WHEN st.id IS NULL THEN NULL ELSE jsonb_build_object('id', st.id, 'name', st.name, 'domain', st.domain) END) AS product
      FROM qualified q JOIN "CatalogProduct" p ON p.id = q.id
      LEFT JOIN "CatalogStore" st ON st.id = p."storeId"
    ), page AS (
      SELECT * FROM ranked ${position}
      ORDER BY score DESC, "distinctVoters" DESC, id LIMIT ${query.limit + 1}
    )
    SELECT coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY score DESC, "distinctVoters" DESC, id) FROM page), '[]'::jsonb) AS items,
      EXISTS(SELECT 1 FROM matched) AS "hasSignals", EXISTS(SELECT 1 FROM qualified) AS "hasQualified",
      md5(coalesce((SELECT string_agg(to_jsonb(ranked)::text, ',' ORDER BY id) FROM ranked), '')) AS fingerprint
  `;
}
