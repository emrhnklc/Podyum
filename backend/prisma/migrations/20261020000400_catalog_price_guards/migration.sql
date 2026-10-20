-- NULL/UNKNOWN SQL sonucunun eksik fiyat-tarih çiftini kabul etmesini engelle.
ALTER TABLE "CatalogProduct" DROP CONSTRAINT "CatalogProduct_price";
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_price" CHECK (
 ("priceMinor" IS NULL) = ("priceRecordedAt" IS NULL) AND ("priceMinor" IS NULL OR "priceMinor" >= 0)
);
ALTER TABLE "CatalogSuggestion" DROP CONSTRAINT "CatalogSuggestion_price";
ALTER TABLE "CatalogSuggestion" ADD CONSTRAINT "CatalogSuggestion_price" CHECK (
 ("priceMinor" IS NULL) = ("priceRecordedAt" IS NULL) AND ("priceMinor" IS NULL OR "priceMinor" >= 0)
);
