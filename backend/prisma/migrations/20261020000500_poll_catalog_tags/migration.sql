ALTER TABLE "ProductTag"
  ADD COLUMN "source" VARCHAR(30) NOT NULL DEFAULT 'USER_ENTERED',
  ADD COLUMN "catalogProductId" UUID,
  ADD COLUMN "catalogSnapshot" JSONB;
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_catalogProductId_fkey"
  FOREIGN KEY ("catalogProductId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_catalog_snapshot_pair" CHECK (
  ("source" = 'USER_ENTERED' AND "catalogProductId" IS NULL AND "catalogSnapshot" IS NULL)
  OR ("source" = 'CATALOG' AND "catalogProductId" IS NOT NULL AND "catalogSnapshot" IS NOT NULL AND jsonb_typeof("catalogSnapshot") = 'object')
);
CREATE INDEX "ProductTag_catalogProductId_idx" ON "ProductTag"("catalogProductId");
CREATE UNIQUE INDEX "ProductTag_optionId_catalogProductId_key" ON "ProductTag"("optionId", "catalogProductId");
