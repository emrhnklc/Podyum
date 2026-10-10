import "dotenv/config";
import { assertProjectDatabase } from "../src/database/assert-database-target.js";
import { createDb } from "../src/database/prisma-client.js";

const [userId, ...words] = process.argv.slice(2);
const reason = words.join(" ").trim();
if (process.env.NODE_ENV === "production") throw new Error("Bu araç yalnız yerel geliştirme içindir.");
if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) || reason.length < 3 || reason.length > 500) {
  throw new Error('Kullanım: npm run admin:grant -- <user-uuid> "3–500 karakter gerekçe"');
}
await assertProjectDatabase();
const db = createDb();
try {
  const receipt = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE") throw new Error("Aktif kullanıcı bulunamadı.");
    if (user.role === "ADMIN") return { userId, role: "ADMIN", changed: false };
    await tx.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
    const audit = await tx.moderationAudit.create({ data: { action: "ROLE_GRANTED", resourceType: "USER", resourceId: userId, reason,
      before: { role: user.role }, after: { role: "ADMIN", source: "LOCAL_CLI" } } });
    await tx.outboxEvent.create({ data: { aggregateType: "moderation-audit", aggregateId: audit.id, aggregateVersion: 1, type: "moderation.action.applied",
      payload: { schemaVersion: 1, auditId: audit.id, action: "ROLE_GRANTED", resourceType: "USER", resourceId: userId } } });
    return { userId, role: "ADMIN", changed: true, auditId: audit.id };
  });
  console.log(JSON.stringify(receipt));
} finally { await db.$disconnect(); }
