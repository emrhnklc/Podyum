-- Prisma'nın liste sütunları SQL'de nullable üretilir. CHECK, NULL sonucunu
-- kabul ettiğinden tamamlanmış işteki boş-dizi kuralını açıkça koruyoruz.
ALTER TABLE "AccountDeletion" ADD CONSTRAINT "AccountDeletion_arrays_present" CHECK (
  "mailTokenHashes" IS NOT NULL AND "pushTokenHashes" IS NOT NULL AND "notificationIds" IS NOT NULL
);
