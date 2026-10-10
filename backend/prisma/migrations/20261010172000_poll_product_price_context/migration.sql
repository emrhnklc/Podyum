-- Önceki beyanların zamanı bilinmiyor; eski fiyatlara sahte tarih atanmaz.
ALTER TABLE "ProductTag" ADD COLUMN "priceRecordedAt" TIMESTAMPTZ(3);
