import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { assertProjectDatabase } from "../src/database/assert-database-target.js";
import { createDb } from "../src/database/prisma-client.js";
import type { Prisma } from "../src/generated/prisma/client.js";
import { cleanTechnicalRecords } from "../src/common/maintenance/technical-retention.js";

await assertProjectDatabase();
const db = createDb();
after(() => db.$disconnect());
const DAY = 86_400_000;
const hash = () => randomBytes(32).toString("hex");
const rollback = new Error("RETENTION_TEST_ROLLBACK");
async function scenario(work: (tx: Prisma.TransactionClient) => Promise<void>) {
  await assert.rejects(db.$transaction(async (tx) => { await work(tx); throw rollback; }, { timeout: 30_000 }), (error) => error === rollback);
}
async function fixture(tx: Prisma.TransactionClient) {
  const user = await tx.user.create({ data: { username: `ret_${randomUUID().replaceAll("-", "").slice(0, 20)}`, displayName: "Bakım testi" } });
  const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
  return { userId: user.id, now, old: new Date("2000-01-01T00:00:00Z"), future: new Date(now.getTime() + 90 * DAY) };
}
async function session(tx: Prisma.TransactionClient, userId: string, expiresAt: Date, revokedAt: Date | null = null) {
  return tx.authSession.create({ data: { userId, provider: "email", accessTokenHash: hash(), refreshTokenHash: hash(), accessExpiresAt: new Date(expiresAt.getTime() - 60_000), expiresAt, revokedAt, createdAt: new Date("1999-01-01T00:00:00Z") } });
}

test("varsayılan rapor silmez; hesap, oturum ve FK çocuklarını değiştirmez", () => scenario(async (tx) => {
  const f = await fixture(tx), old = await session(tx, f.userId, f.old);
  const token = await tx.usedRefreshToken.create({ data: { sessionId: old.id, tokenHash: hash(), expiresAt: f.old } });
  const report = await cleanTechnicalRecords(tx);
  assert.equal(report.mode, "dry-run"); assert.equal(report.sessions.deleted, 0); assert.ok(report.sessions.candidates > 0);
  assert.ok(await tx.authSession.findUnique({ where: { id: old.id } }));
  assert.ok(await tx.usedRefreshToken.findUnique({ where: { tokenHash: token.tokenHash } }));
  assert.equal(JSON.stringify(report).includes(f.userId), false); assert.equal(JSON.stringify(report).includes(token.tokenHash), false);
}));

test("eski oturum ve FK çocukları atomik temizlenir; aktif ve yakın zamanda kapanmış oturumlar korunur", () => scenario(async (tx) => {
  const f = await fixture(tx), expired = await session(tx, f.userId, f.old), revoked = await session(tx, f.userId, f.future, f.old);
  const active = await session(tx, f.userId, f.future), recent = await session(tx, f.userId, new Date(f.now.getTime() - DAY));
  const device = await tx.deviceToken.create({ data: { userId: f.userId, sessionId: expired.id, installationId: randomUUID(), token: `test-${randomUUID()}`, platform: "ios" } });
  const replay = await tx.usedRefreshToken.create({ data: { sessionId: expired.id, tokenHash: hash(), expiresAt: f.future } });
  const liveReplay = await tx.usedRefreshToken.create({ data: { sessionId: active.id, tokenHash: hash(), expiresAt: f.future } });
  const report = await cleanTechnicalRecords(tx, { apply: true, batchSize: 500 });
  for (const id of [expired.id, revoked.id]) assert.equal(await tx.authSession.findUnique({ where: { id } }), null);
  for (const id of [active.id, recent.id]) assert.ok(await tx.authSession.findUnique({ where: { id } }));
  assert.equal(await tx.deviceToken.findUnique({ where: { id: device.id } }), null);
  assert.equal(await tx.usedRefreshToken.findUnique({ where: { tokenHash: replay.tokenHash } }), null);
  assert.ok(await tx.usedRefreshToken.findUnique({ where: { tokenHash: liveReplay.tokenHash } }));
  assert.ok(await tx.user.findUnique({ where: { id: f.userId } })); assert.ok(report.sessions.deleted >= 2);
}));

test("eski token ve makbuz temizlenir; geçerli/ek beklemedeki kayıtlar ve oyun/oy sonuçları korunur", () => scenario(async (tx) => {
  const f = await fixture(tx), active = await session(tx, f.userId, f.future);
  const replay = await tx.usedRefreshToken.create({ data: { sessionId: active.id, tokenHash: hash(), expiresAt: f.old } });
  const oldAction = await tx.authActionToken.create({ data: { userId: f.userId, kind: "RESET_PASSWORD", tokenHash: hash(), credentialVersion: 1, expiresAt: f.old } });
  const liveAction = await tx.authActionToken.create({ data: { userId: f.userId, kind: "VERIFY_EMAIL", tokenHash: hash(), credentialVersion: 1, expiresAt: f.future } });
  const receipt = (key: string, expiresAt: Date) => tx.idempotencyRecord.create({ data: { userId: f.userId, scope: "retention-test", key, requestHash: hash(), responseCode: 200, responseBody: {}, expiresAt } });
  await receipt("old-key", f.old); await receipt("recent-key", new Date(f.now.getTime() - DAY)); await receipt("live-key", f.future);
  const before = { votes: await tx.pollVote.count(), scores: await tx.gameScore.count(), outcomes: await tx.gameOutcome.count(), league: await tx.gameLeaguePoint.count(), notifications: await tx.notification.count(), audits: await tx.moderationAudit.count() };
  await cleanTechnicalRecords(tx, { apply: true, batchSize: 500 });
  assert.equal(await tx.usedRefreshToken.findUnique({ where: { tokenHash: replay.tokenHash } }), null);
  assert.equal(await tx.authActionToken.findUnique({ where: { id: oldAction.id } }), null);
  assert.ok(await tx.authActionToken.findUnique({ where: { id: liveAction.id } }));
  for (const [key, exists] of [["old-key", false], ["recent-key", true], ["live-key", true]] as const) assert.equal(!!await tx.idempotencyRecord.findUnique({ where: { userId_scope_key: { userId: f.userId, scope: "retention-test", key } } }), exists);
  assert.deepEqual({ votes: await tx.pollVote.count(), scores: await tx.gameScore.count(), outcomes: await tx.gameOutcome.count(), league: await tx.gameLeaguePoint.count(), notifications: await tx.notification.count(), audits: await tx.moderationAudit.count() }, before);
}));

test("yalnız eski yayımlanmış outbox silinir; bekleyen, başarısız, lease altındaki ve yeni işler korunur", () => scenario(async (tx) => {
  const f = await fixture(tx);
  const event = (publishedAt: Date | null, leaseUntil: Date | null = null, attempts = 0) => tx.outboxEvent.create({ data: { aggregateType: "retention-test", aggregateId: f.userId, aggregateVersion: 0, type: "test.retention", payload: { secret: "rapora-girmemeli" }, publishedAt, leaseUntil, attempts } });
  const old = await event(f.old), pending = await event(null), failed = await event(null, null, 12), leased = await event(f.old, f.future), recent = await event(f.now);
  const report = await cleanTechnicalRecords(tx, { apply: true, batchSize: 500 });
  assert.equal(await tx.outboxEvent.findUnique({ where: { id: old.id } }), null);
  for (const row of [pending, failed, leased, recent]) assert.ok(await tx.outboxEvent.findUnique({ where: { id: row.id } }));
  assert.equal(JSON.stringify(report).includes("rapora-girmemeli"), false);
}));

test("batch sınırı uygulanır ve tekrar çalıştırmak ikinci silme üretmez", () => scenario(async (tx) => {
  const f = await fixture(tx);
  const rows = [];
  for (let i = 0; i < 3; i++) rows.push(await tx.authActionToken.create({ data: { userId: f.userId, kind: "RESET_PASSWORD", tokenHash: hash(), credentialVersion: 1, expiresAt: f.old } }));
  const first = await cleanTechnicalRecords(tx, { apply: true, batchSize: 1 }); assert.equal(first.actions.deleted, 1); assert.equal(first.actions.hasMore, true);
  assert.equal(await tx.authActionToken.count({ where: { id: { in: rows.map((row) => row.id) } } }), 2);
  await cleanTechnicalRecords(tx, { apply: true, batchSize: 500 });
  const second = await cleanTechnicalRecords(tx, { apply: true, batchSize: 500 });
  assert.equal(await tx.authActionToken.count({ where: { id: { in: rows.map((row) => row.id) } } }), 0); assert.equal(second.actions.deleted, 0);
}));

test("geçersiz sınırlar veya silme modu DB yazmadan reddedilir", () => scenario(async (tx) => {
  for (const batchSize of [0, -1, 501, 1.5, NaN]) await assert.rejects(cleanTechnicalRecords(tx, { apply: true, batchSize }));
  await assert.rejects(cleanTechnicalRecords(tx, { apply: "true" as unknown as boolean }));
}));
