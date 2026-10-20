CREATE TYPE "CatalogProductStatus" AS ENUM ('ACTIVE','ARCHIVED','MERGED');
CREATE TYPE "CatalogSuggestionStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
ALTER TYPE "ModerationAction" ADD VALUE 'CATALOG_STORE_CREATED';
ALTER TYPE "ModerationAction" ADD VALUE 'CATALOG_STORE_UPDATED';
ALTER TYPE "ModerationAction" ADD VALUE 'CATALOG_PRODUCT_CREATED';
ALTER TYPE "ModerationAction" ADD VALUE 'CATALOG_PRODUCT_UPDATED';
ALTER TYPE "ModerationAction" ADD VALUE 'CATALOG_PRODUCT_MERGED';
ALTER TYPE "ModerationAction" ADD VALUE 'CATALOG_SUGGESTION_REVIEWED';
ALTER TYPE "AdminResourceType" ADD VALUE 'CATALOG_STORE';
ALTER TYPE "AdminResourceType" ADD VALUE 'CATALOG_PRODUCT';
ALTER TYPE "AdminResourceType" ADD VALUE 'CATALOG_SUGGESTION';
CREATE TABLE "CatalogStore" (
 "id" UUID PRIMARY KEY, "name" VARCHAR(100) NOT NULL, "domain" VARCHAR(253) NOT NULL UNIQUE,
 "trackingParameters" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "active" BOOLEAN NOT NULL DEFAULT true,
 "version" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CatalogStore_version" CHECK ("version" >= 0)
);
CREATE TABLE "CatalogProduct" (
 "id" UUID PRIMARY KEY, "storeId" UUID REFERENCES "CatalogStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "externalId" VARCHAR(120), "variantKey" VARCHAR(120) NOT NULL DEFAULT '',
 "title" VARCHAR(150) NOT NULL, "normalizedTitle" VARCHAR(450) NOT NULL, "brand" VARCHAR(100),
 "category" "PollCategory" NOT NULL, "canonicalUrl" VARCHAR(2048), "source" VARCHAR(30) NOT NULL DEFAULT 'ADMIN_REVIEWED',
 "status" "CatalogProductStatus" NOT NULL DEFAULT 'ACTIVE', "priceMinor" INTEGER, "currency" CHAR(3) NOT NULL DEFAULT 'TRY',
 "priceRecordedAt" TIMESTAMPTZ(3), "version" INTEGER NOT NULL DEFAULT 0,
 "mergedIntoId" UUID REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT "CatalogProduct_external_key" UNIQUE ("storeId","externalId","variantKey"),
 CONSTRAINT "CatalogProduct_version" CHECK ("version" >= 0),
 CONSTRAINT "CatalogProduct_external_store" CHECK ("externalId" IS NULL OR "storeId" IS NOT NULL),
 CONSTRAINT "CatalogProduct_price" CHECK (("priceMinor" IS NULL AND "priceRecordedAt" IS NULL) OR ("priceMinor" >= 0 AND "priceRecordedAt" IS NOT NULL)),
 CONSTRAINT "CatalogProduct_currency" CHECK ("currency" ~ '^[A-Z]{3}$'),
 CONSTRAINT "CatalogProduct_merge" CHECK (("status" = 'MERGED' AND "mergedIntoId" IS NOT NULL AND "mergedIntoId" <> "id") OR ("status" <> 'MERGED' AND "mergedIntoId" IS NULL))
);
CREATE INDEX "CatalogProduct_status_createdAt_id_idx" ON "CatalogProduct"("status","createdAt" DESC,"id" DESC);
CREATE INDEX "CatalogProduct_normalizedTitle_idx" ON "CatalogProduct"("normalizedTitle");
CREATE INDEX "CatalogProduct_mergedIntoId_idx" ON "CatalogProduct"("mergedIntoId");
CREATE TABLE "CatalogProductUrl" (
 "id" UUID PRIMARY KEY, "productId" UUID NOT NULL REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "normalizedUrl" VARCHAR(2048) NOT NULL UNIQUE, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CatalogProductUrl_productId_idx" ON "CatalogProductUrl"("productId");
CREATE TABLE "CatalogSuggestion" (
 "id" UUID PRIMARY KEY, "submittedById" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "fingerprint" CHAR(64) NOT NULL, "title" VARCHAR(150) NOT NULL, "brand" VARCHAR(100), "category" "PollCategory" NOT NULL,
 "originalUrl" VARCHAR(2048), "normalizedUrl" VARCHAR(2048), "priceMinor" INTEGER, "currency" CHAR(3) NOT NULL DEFAULT 'TRY',
 "priceRecordedAt" TIMESTAMPTZ(3), "status" "CatalogSuggestionStatus" NOT NULL DEFAULT 'PENDING',
 "resolvedProductId" UUID REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "decisionReason" VARCHAR(500), "version" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CatalogSuggestion_owner_fingerprint" UNIQUE ("submittedById","fingerprint"),
 CONSTRAINT "CatalogSuggestion_version" CHECK ("version" >= 0),
 CONSTRAINT "CatalogSuggestion_price" CHECK (("priceMinor" IS NULL AND "priceRecordedAt" IS NULL) OR ("priceMinor" >= 0 AND "priceRecordedAt" IS NOT NULL)),
 CONSTRAINT "CatalogSuggestion_currency" CHECK ("currency" ~ '^[A-Z]{3}$'),
 CONSTRAINT "CatalogSuggestion_decision" CHECK (("status" = 'PENDING' AND "resolvedProductId" IS NULL AND "decisionReason" IS NULL) OR ("status" = 'APPROVED' AND "resolvedProductId" IS NOT NULL AND "decisionReason" IS NOT NULL) OR ("status" = 'REJECTED' AND "resolvedProductId" IS NULL AND "decisionReason" IS NOT NULL))
);
CREATE INDEX "CatalogSuggestion_owner_createdAt_id_idx" ON "CatalogSuggestion"("submittedById","createdAt" DESC,"id" DESC);
CREATE INDEX "CatalogSuggestion_status_createdAt_id_idx" ON "CatalogSuggestion"("status","createdAt" DESC,"id" DESC);
CREATE INDEX "CatalogSuggestion_resolvedProductId_idx" ON "CatalogSuggestion"("resolvedProductId");
