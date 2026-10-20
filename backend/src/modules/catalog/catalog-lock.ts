import type { Prisma } from "../../generated/prisma/client.js";

// Katalog yönetimi ve yayın snapshot'ı aynı sıralamayı kullanır. Birleşme
// zincirleri değişirken farklı kimliklerden kilit almak ters sıraya düşmez.
export async function lockCatalog(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('catalog-write-v1', 0))::text`;
}
