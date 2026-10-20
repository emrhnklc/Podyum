CREATE TABLE "TrendContribution" (
  "pollId" UUID NOT NULL,
  "voterId" UUID NOT NULL,
  "sourceCatalogProductId" UUID NOT NULL,
  "productTagId" UUID NOT NULL,
  "votedAt" TIMESTAMPTZ(3) NOT NULL,
  "category" "PollCategory" NOT NULL,
  "brand" VARCHAR(100),
  "priceMinor" INTEGER,
  "currency" CHAR(3) NOT NULL,
  "priceRecordedAt" TIMESTAMPTZ(3),
  "catalogVersion" INTEGER NOT NULL,
  "catalogSource" VARCHAR(30) NOT NULL,
  "projectionVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "TrendContribution_pkey" PRIMARY KEY ("pollId", "voterId", "sourceCatalogProductId"),
  CONSTRAINT "TrendContribution_vote_fkey" FOREIGN KEY ("pollId", "voterId") REFERENCES "PollVote"("pollId", "voterId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TrendContribution_tag_fkey" FOREIGN KEY ("productTagId") REFERENCES "ProductTag"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TrendContribution_product_fkey" FOREIGN KEY ("sourceCatalogProductId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TrendContribution_price" CHECK (("priceMinor" IS NULL) = ("priceRecordedAt" IS NULL) AND ("priceMinor" IS NULL OR "priceMinor" >= 0)),
  CONSTRAINT "TrendContribution_versions" CHECK ("catalogVersion" >= 0 AND "projectionVersion" = 1),
  CONSTRAINT "TrendContribution_currency" CHECK ("currency" ~ '^[A-Z]{3}$')
);
CREATE INDEX "TrendContribution_productTagId_idx" ON "TrendContribution"("productTagId");
CREATE INDEX "TrendContribution_votedAt_sourceCatalogProductId_idx" ON "TrendContribution"("votedAt", "sourceCatalogProductId");
CREATE INDEX "TrendContribution_sourceCatalogProductId_votedAt_idx" ON "TrendContribution"("sourceCatalogProductId", "votedAt");

-- Yalnız backend'in kullanacağı türetilmiş kaynak. İzin/durum/görünürlük
-- değişikliği kuyruk tüketimini beklemeden burada geçerlidir.
CREATE VIEW "TrendEligibleContribution" AS
WITH RECURSIVE catalog AS (
  SELECT p."id" AS "sourceId", p."id", p."status", p."mergedIntoId", p."storeId", ARRAY[p."id"] AS path, 0 AS depth, false AS cycle
  FROM "CatalogProduct" p
  UNION ALL
  SELECT c."sourceId", p."id", p."status", p."mergedIntoId", p."storeId", c.path || p."id", c.depth + 1, p."id" = ANY(c.path)
  FROM catalog c JOIN "CatalogProduct" p ON p."id" = c."mergedIntoId"
  WHERE c."status" = 'MERGED' AND NOT c.cycle AND c.depth < 50
), terminal AS (
  SELECT c."sourceId", c."id" FROM catalog c
  LEFT JOIN "CatalogStore" s ON s."id" = c."storeId"
  WHERE c."status" = 'ACTIVE' AND NOT c.cycle AND (c."storeId" IS NULL OR s."active")
), eligible AS (
  SELECT c.*, terminal."id" AS "catalogProductId", (v."createdAt" AT TIME ZONE 'Europe/Istanbul')::date AS "trendDay",
    (u."status" = 'ACTIVE' AND up."analyticsConsentAt" IS NOT NULL
      AND v."analyticsConsentAtVote" = up."analyticsConsentAt"
      AND v."analyticsRevisionAtVote" <= up."analyticsRevision") IS TRUE AS "demographicsAllowed",
    v."genderAtVote" AS gender, v."ageBandAtVote" AS age
  FROM "TrendContribution" c
  JOIN "PollVote" v ON v."pollId" = c."pollId" AND v."voterId" = c."voterId"
  JOIN "Poll" p ON p."id" = v."pollId"
  JOIN "User" author ON author."id" = p."authorId"
  JOIN "User" u ON u."id" = v."voterId"
  LEFT JOIN "UserPrivate" up ON up."userId" = v."voterId"
  JOIN "ProductTag" tag ON tag."id" = c."productTagId" AND tag."optionId" = v."optionId" AND tag."catalogProductId" = c."sourceCatalogProductId"
  JOIN terminal ON terminal."sourceId" = c."sourceCatalogProductId"
  WHERE p."visibility" = 'PUBLIC' AND p."status" IN ('OPEN', 'CLOSED') AND p."contentStatus" = 'VISIBLE'
    AND author."status" = 'ACTIVE' AND u."status" IN ('ACTIVE', 'DELETED') AND p."authorId" <> v."voterId"
    AND p."audienceGender" = 'ANY' AND p."audienceAgeBand" IS NULL AND NOT p."styleMatchRequired"
    AND p."publishedAt" <= v."createdAt" AND v."createdAt" < p."closesAt" AND v."createdAt" <= clock_timestamp()
    AND tag."source" = 'CATALOG' AND c."projectionVersion" = 1 AND c."votedAt" = v."createdAt"
)
SELECT DISTINCT ON ("pollId", "voterId", "catalogProductId")
  "pollId", "voterId", "catalogProductId", "sourceCatalogProductId", "productTagId", "votedAt", "trendDay",
  "category", "brand", "priceMinor", "currency", "priceRecordedAt", "catalogVersion", "catalogSource", "demographicsAllowed",
  CASE WHEN "demographicsAllowed" THEN gender ELSE NULL END AS "genderAtVote",
  CASE WHEN "demographicsAllowed" THEN age ELSE NULL END AS "ageBandAtVote"
FROM eligible ORDER BY "pollId", "voterId", "catalogProductId", "productTagId";

-- Geliştirme puan politikası: kişi/ürün/İstanbul takvim günü başına ilk
-- geçerli tercih. Ham ölçüm yukarıdaki görünümde ve asıl oyda korunur.
CREATE VIEW "TrendDailySignal" AS
SELECT DISTINCT ON ("trendDay", "catalogProductId", "voterId") *
FROM "TrendEligibleContribution"
ORDER BY "trendDay", "catalogProductId", "voterId", "votedAt", "pollId", "productTagId";
