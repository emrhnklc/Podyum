import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

const DAY = 86_400_000;
// Yerel teknik bakım varsayımları; içerik veya yasal saklama politikası değildir.
export const TECHNICAL_RETENTION = Object.freeze({ expiredGraceDays: 7, publishedOutboxDays: 30 });
export type RetentionOptions = { apply?: boolean; batchSize?: number };
type BatchReport = { candidates: number; deleted: number; hasMore: boolean };
const batchReport = (count: number, size: number): BatchReport => ({ candidates: Math.min(count, size), deleted: 0, hasMore: count > size });

// Çağıran transaction açar; testler aynı işi rollback ile doğrulayabilir.
// Kimlik, token/hash veya payload rapora girmez. Aktif içerik bu işin kapsamında değildir.
export async function cleanTechnicalRecords(tx: Prisma.TransactionClient, { apply = false, batchSize = 100 }: RetentionOptions = {}) {
  if (typeof apply !== "boolean" || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500)
    throw new Error("Bakım apply boolean ve batchSize 1–500 tamsayı olmalı.");
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('podyum-technical-retention-v1', 0))::text`;
  const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
  const expiredBefore = new Date(now.getTime() - TECHNICAL_RETENTION.expiredGraceDays * DAY);
  const publishedBefore = new Date(now.getTime() - TECHNICAL_RETENTION.publishedOutboxDays * DAY);
  const sessionRows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "AuthSession" WHERE "expiresAt" <= ${expiredBefore} OR "revokedAt" <= ${expiredBefore}
    ORDER BY "expiresAt", "id" LIMIT ${batchSize + 1} FOR UPDATE SKIP LOCKED`;
  const sessions = batchReport(sessionRows.length, batchSize);
  const sessionIds = sessionRows.slice(0, batchSize).map((row) => row.id);
  const devices = { candidates: sessionIds.length ? await tx.deviceToken.count({ where: { sessionId: { in: sessionIds } } }) : 0, deleted: 0 };
  const sessionRefresh = { candidates: sessionIds.length ? await tx.usedRefreshToken.count({ where: { sessionId: { in: sessionIds } } }) : 0, deleted: 0 };
  if (apply && sessionIds.length) {
    devices.deleted = (await tx.deviceToken.deleteMany({ where: { sessionId: { in: sessionIds } } })).count;
    sessionRefresh.deleted = (await tx.usedRefreshToken.deleteMany({ where: { sessionId: { in: sessionIds } } })).count;
    sessions.deleted = (await tx.authSession.deleteMany({ where: { id: { in: sessionIds } } })).count;
  }

  const actionWhere = { expiresAt: { lte: expiredBefore } };
  const actionRows = await tx.authActionToken.findMany({ where: actionWhere, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: batchSize + 1, select: { id: true } });
  const actions = batchReport(actionRows.length, batchSize);
  if (apply && actions.candidates) actions.deleted = (await tx.authActionToken.deleteMany({ where: { ...actionWhere, id: { in: actionRows.slice(0, batchSize).map((row) => row.id) } } })).count;

  // Silinmeyen oturumların replay kayıtları kendi süresi + ek bekleme dolmadan silinmez.
  const refreshWhere = { expiresAt: { lte: expiredBefore }, sessionId: { notIn: sessionIds } };
  const refreshRows = await tx.usedRefreshToken.findMany({ where: refreshWhere, orderBy: [{ expiresAt: "asc" }, { tokenHash: "asc" }], take: batchSize + 1, select: { tokenHash: true } });
  const refreshTokens = batchReport(refreshRows.length, batchSize);
  if (apply && refreshTokens.candidates) refreshTokens.deleted = (await tx.usedRefreshToken.deleteMany({ where: { ...refreshWhere, tokenHash: { in: refreshRows.slice(0, batchSize).map((row) => row.tokenHash) } } })).count;

  const receiptWhere = { expiresAt: { lte: expiredBefore } };
  const receiptRows = await tx.idempotencyRecord.findMany({ where: receiptWhere, orderBy: [{ expiresAt: "asc" }, { userId: "asc" }, { scope: "asc" }, { key: "asc" }], take: batchSize + 1, select: { userId: true, scope: true, key: true } });
  const idempotency = batchReport(receiptRows.length, batchSize);
  if (apply && idempotency.candidates) idempotency.deleted = (await tx.idempotencyRecord.deleteMany({ where: { ...receiptWhere, OR: receiptRows.slice(0, batchSize) } })).count;

  // Bekleyen/başarısız işler ve etkin lease'ler korunur. Yeniden oynatma arşivi değildir.
  const outboxWhere = { publishedAt: { lte: publishedBefore }, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] };
  const outboxRows = await tx.outboxEvent.findMany({ where: outboxWhere, orderBy: [{ publishedAt: "asc" }, { id: "asc" }], take: batchSize + 1, select: { id: true } });
  const outbox = batchReport(outboxRows.length, batchSize);
  if (apply && outbox.candidates) outbox.deleted = (await tx.outboxEvent.deleteMany({ where: { ...outboxWhere, id: { in: outboxRows.slice(0, batchSize).map((row) => row.id) } } })).count;
  return { mode: apply ? "apply" : "dry-run", serverNow: now.toISOString(), expiredBefore: expiredBefore.toISOString(), publishedBefore: publishedBefore.toISOString(), batchSize,
    sessions, devices, sessionRefreshTokens: sessionRefresh, actions, refreshTokens, idempotency, outbox };
}

export async function runTechnicalRetention(db: Pick<PrismaClient, "$transaction">, options: RetentionOptions = {}) {
  return db.$transaction((tx) => cleanTechnicalRecords(tx, options), { maxWait: 10_000, timeout: 30_000 });
}
