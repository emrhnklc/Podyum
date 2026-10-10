import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const { createApp } = await import(new URL("../dist/create-app.js", import.meta.url).href) as { createApp: () => Promise<NestExpressApplication> };
const { PrismaService } = await import(new URL("../dist/database/prisma.service.js", import.meta.url).href);
const { PollParticipationService } = await import(new URL("../dist/modules/polls/poll-participation.service.js", import.meta.url).href);
const { PollCloseWorker } = await import(new URL("../dist/modules/polls/poll-close.worker.js", import.meta.url).href);
type Actor = { id: string; token: string };
let app: NestExpressApplication;
let db: PrismaClient;
let base: string;
let actors: Actor[];
let polls: string[];
const beforeEnv = { NODE_ENV: process.env.NODE_ENV, AUTH_MOCK_ENABLED: process.env.AUTH_MOCK_ENABLED };

async function call(method: string, path: string, actor: Actor | null = actors[0], body?: unknown) {
  const response = await fetch(`${base}${path}`, { method, headers: {
    ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  return { status: response.status, body: await response.json() as any };
}

async function poll(options: { count?: number; visibility?: "PUBLIC" | "FRIENDS"; expired?: boolean } = {}) {
  const now = new Date();
  const row = await db.poll.create({ data: { authorId: actors[0].id, question: "Hangisi?", category: "OUTFIT", status: "OPEN", visibility: options.visibility ?? "PUBLIC",
    publishedAt: new Date(now.getTime() - 10000), closesAt: new Date(now.getTime() + (options.expired ? -1000 : 1800000)),
    options: { create: Array.from({ length: options.count ?? 2 }, (_, index) => ({ position: index + 1, media: { create: {
      ownerId: actors[0].id, purpose: "POLL", status: "READY", uploadKey: `test-${randomUUID()}`, displayKey: `test-${randomUUID()}`, thumbnailKey: `test-${randomUUID()}`, previewAcceptedAt: now,
    } }, products: { create: { title: "Kullanıcı ürünü", externalUrl: "https://example.com/item?ref=original", priceMinor: 10000, priceRecordedAt: now } } })) },
  }, include: { options: { orderBy: { position: "asc" } } } });
  polls.push(row.id);
  return row;
}

async function vote(row: Awaited<ReturnType<typeof poll>>, actor = actors[1], optionIndex = 0) {
  return call("PUT", `/polls/${row.id}/vote`, actor, { optionId: row.options[optionIndex].id });
}

beforeEach(async () => {
  process.env.NODE_ENV = "test";
  process.env.AUTH_MOCK_ENABLED = "true";
  actors = []; polls = [];
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = `${await app.getUrl()}/v1`;
  db = app.get(PrismaService);
  for (let index = 0; index < 4; index++) {
    const session = await call("POST", "/auth/mock", null, { provider: "google", subject: `votes_${randomUUID()}`, acknowledgeMock: true });
    assert.equal(session.status, 200);
    const actor = { id: "", token: session.body.accessToken };
    actor.id = (await call("GET", "/auth/me", actor)).body.user.id;
    actors.push(actor);
  }
});

afterEach(async () => {
  try {
    const ids = actors.map((actor) => actor.id);
    await db.$transaction(async (tx) => {
      await tx.outboxEvent.deleteMany({ where: { aggregateId: { in: [...ids, ...polls] } } });
      await tx.pollVote.deleteMany({ where: { pollId: { in: polls } } });
      await tx.productTag.deleteMany({ where: { option: { pollId: { in: polls } } } });
      await tx.pollOption.deleteMany({ where: { pollId: { in: polls } } });
      await tx.poll.deleteMany({ where: { id: { in: polls } } });
      await tx.mediaAsset.deleteMany({ where: { ownerId: { in: ids } } });
      await tx.block.deleteMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } });
      await tx.friendship.deleteMany({ where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } });
      await tx.userPrivate.deleteMany({ where: { userId: { in: ids } } });
      await tx.usedRefreshToken.deleteMany({ where: { session: { userId: { in: ids } } } });
      await tx.authSession.deleteMany({ where: { userId: { in: ids } } });
      await tx.authIdentity.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    });
  } finally {
    await app?.close();
    for (const key of Object.keys(beforeEnv) as (keyof typeof beforeEnv)[]) {
      if (beforeEnv[key] === undefined) delete process.env[key]; else process.env[key] = beforeEnv[key];
    }
  }
});

test("tercih/sonuç oturum ve katı DTO ister; sahte kimlik/snapshot kabul edilmez", async () => {
  const row = await poll();
  assert.equal((await call("PUT", `/polls/${row.id}/vote`, null, { optionId: row.options[0].id })).status, 401);
  assert.equal((await call("GET", `/polls/${row.id}/results`, null)).status, 401);
  for (const body of [{}, { optionId: null }, { optionId: "bad" }, { optionId: row.options[0].id, voterId: actors[3].id }, { optionId: row.options[0].id, genderAtVote: "WOMAN" }]) {
    assert.equal((await call("PUT", `/polls/${row.id}/vote`, actors[1], body)).status, 400);
  }
  assert.equal((await call("GET", "/polls/bad/results")).status, 400);
  assert.equal(await db.pollVote.count({ where: { pollId: row.id } }), 0);
});

test("tek tercih aynı makbuzu döndürür; değiştirme/kendi oyu/başka seçeneği reddedilir, puan üretilmez", async () => {
  const row = await poll();
  assert.equal((await vote(row, actors[0])).body.error.code, "SELF_VOTE_NOT_ALLOWED");
  const other = await poll();
  assert.equal((await call("PUT", `/polls/${row.id}/vote`, actors[1], { optionId: other.options[0].id })).body.error.code, "OPTION_NOT_IN_POLL");
  const accepted = await vote(row);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.deepEqual(Object.keys(accepted.body).sort(), ["acceptedAt", "optionId", "pollId"]);
  assert.deepEqual((await vote(row)).body, accepted.body);
  assert.equal((await vote(row, actors[1], 1)).body.error.code, "VOTE_ALREADY_CAST");
  assert.equal(await db.pollVote.count({ where: { pollId: row.id } }), 1);
  assert.equal((await db.poll.findUniqueOrThrow({ where: { id: row.id } })).version, 1);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: row.id, type: "poll.vote.cast" } }), 1);
  assert.equal(await db.pointsLedger.count({ where: { userId: { in: actors.map((actor) => actor.id) } } }), 0);
});

test("sonuç yazar/oy veren için açık, oy vermeyene kapanışa kadar kapalı; detay uygunluk döndürür", async () => {
  const row = await poll();
  const before = (await call("GET", `/polls/${row.id}`, actors[1])).body;
  assert.equal(before.canVote, true);
  assert.equal(before.canViewResults, false);
  assert.equal(before.myOptionId, null);
  assert.equal((await call("GET", `/polls/${row.id}/results`, actors[1])).body.error.code, "RESULTS_NOT_AVAILABLE");
  const empty = (await call("GET", `/polls/${row.id}/results`)).body;
  assert.equal(empty.totalVotes, 0);
  assert.deepEqual(empty.winningOptionIds, []);
  assert.deepEqual(empty.options.map((option: any) => option.percentage), [0, 0]);
  assert.equal(empty.isFinal, false);
  await vote(row);
  const after = (await call("GET", `/polls/${row.id}`, actors[1])).body;
  assert.equal(after.canVote, false); assert.equal(after.canViewResults, true); assert.equal(after.myOptionId, row.options[0].id);
  const result = (await call("GET", `/polls/${row.id}/results`, actors[1])).body;
  assert.equal(result.totalVotes, 1); assert.equal(result.myOptionId, row.options[0].id);
  assert.deepEqual(result.options.map((option: any) => option.votes), [1, 0]);
  assert.deepEqual(result.options.map((option: any) => option.percentage), [100, 0]);
  assert.equal("voterId" in result, false);
});

test("yüzdeler 100'e tamamlanır, eşitlik ham oylarla belirlenir ve oy almayan seçenek korunur", async () => {
  const row = await poll({ count: 4 });
  for (let i = 1; i <= 3; i++) assert.equal((await vote(row, actors[i], i - 1)).status, 200);
  const result = (await call("GET", `/polls/${row.id}/results`)).body;
  assert.equal(result.totalVotes, 3);
  assert.deepEqual(result.options.map((option: any) => option.percentage), [34, 33, 33, 0]);
  assert.deepEqual(result.winningOptionIds, row.options.slice(0, 3).map((option) => option.id));
});

test("süre dolunca işçi beklenmeden geç oy durur ve sonuç kesin olur; eski kabulün tekrarı korunur", async () => {
  const row = await poll();
  const receipt = await vote(row);
  await db.poll.update({ where: { id: row.id }, data: { closesAt: new Date(Date.now() - 1000) } });
  assert.equal((await vote(row, actors[2])).body.error.code, "POLL_EXPIRED");
  assert.deepEqual((await vote(row)).body, receipt.body);
  const result = (await call("GET", `/polls/${row.id}/results`, actors[2])).body;
  assert.equal(result.isFinal, true); assert.equal(result.status, "CLOSED"); assert.equal(result.storedStatus, "OPEN");
  assert.equal(result.totalVotes, 1);
  assert.equal((await call("GET", `/polls/${row.id}`, actors[2])).body.canVote, false);
});

test("FRIENDS erişimi oy/sonuç tekrarında da yenilenir; arkadaşlıktan çıkarma/engel eski oyu silmez", async () => {
  const row = await poll({ visibility: "FRIENDS" });
  assert.equal((await vote(row)).status, 404);
  await call("POST", "/friend-requests", actors[0], { targetUserId: actors[1].id });
  await call("POST", `/friend-requests/${actors[0].id}/accept`, actors[1]);
  assert.equal((await vote(row)).status, 200);
  await call("DELETE", `/friends/${actors[1].id}`);
  assert.equal((await vote(row)).status, 404);
  assert.equal((await call("GET", `/polls/${row.id}/results`, actors[1])).status, 404);
  assert.equal((await call("GET", `/polls/${row.id}/results`)).body.totalVotes, 1);
  const publicRow = await poll(); await vote(publicRow);
  await call("PUT", `/blocks/${actors[1].id}`);
  assert.equal((await vote(publicRow)).status, 404);
  assert.equal((await call("GET", `/polls/${publicRow.id}/results`, actors[1])).status, 404);
  assert.equal(await db.pollVote.count({ where: { voterId: actors[1].id } }), 2);
});

test("taslak/iptal/moderasyon/inaktif yazar ve desteklenmeyen hedefleme oy açmaz", async () => {
  const row = await poll();
  for (const status of ["DRAFT", "CANCELLED"] as const) {
    await db.poll.update({ where: { id: row.id }, data: { status } });
    assert.equal((await vote(row)).status, 404);
    assert.equal((await call("GET", `/polls/${row.id}/results`)).status, 404);
  }
  await db.poll.update({ where: { id: row.id }, data: { status: "OPEN" } });
  for (const contentStatus of ["HIDDEN", "REMOVED"] as const) {
    await db.poll.update({ where: { id: row.id }, data: { contentStatus } });
    assert.equal((await vote(row)).status, 404);
  }
  await db.poll.update({ where: { id: row.id }, data: { contentStatus: "VISIBLE", audienceGender: "WOMEN" } });
  assert.equal((await vote(row)).body.error.code, "UNSUPPORTED_AUDIENCE");
  assert.equal((await call("GET", `/polls/${row.id}`, actors[1])).body.canVote, false);
  await db.user.update({ where: { id: actors[0].id }, data: { status: "SUSPENDED" } });
  assert.equal((await vote(row)).status, 404);
});

test("izin yoksa snapshot boş; izinli oy geçmiş profilden bağımsızdır; geri alma demografiyi temizler", async () => {
  const first = await poll(); const second = await poll();
  await call("PATCH", "/me/private", actors[1], { gender: "WOMAN", ageBand: "AGE_18_24" });
  assert.equal((await vote(first)).status, 200);
  const noConsent = await db.pollVote.findUniqueOrThrow({ where: { pollId_voterId: { pollId: first.id, voterId: actors[1].id } } });
  assert.equal(noConsent.genderAtVote, null); assert.equal(noConsent.analyticsConsentAtVote, null);
  const consent = await call("PATCH", "/me/private", actors[1], { analyticsConsent: true });
  assert.equal(consent.status, 200, JSON.stringify(consent.body));
  assert.equal((await vote(second)).status, 200);
  let snapshot = await db.pollVote.findUniqueOrThrow({ where: { pollId_voterId: { pollId: second.id, voterId: actors[1].id } } });
  assert.equal(snapshot.genderAtVote, "WOMAN"); assert.equal(snapshot.ageBandAtVote, "AGE_18_24");
  assert.equal(snapshot.analyticsRevisionAtVote, consent.body.analyticsRevision); assert.ok(snapshot.analyticsConsentAtVote);
  await call("PATCH", "/me/private", actors[1], { gender: "MAN" });
  snapshot = await db.pollVote.findUniqueOrThrow({ where: { pollId_voterId: { pollId: second.id, voterId: actors[1].id } } });
  assert.equal(snapshot.genderAtVote, "WOMAN");
  assert.equal((await call("PATCH", "/me/private", actors[1], { analyticsConsent: false })).status, 200);
  snapshot = await db.pollVote.findUniqueOrThrow({ where: { pollId_voterId: { pollId: second.id, voterId: actors[1].id } } });
  assert.equal(snapshot.genderAtVote, null); assert.equal(snapshot.ageBandAtVote, null); assert.equal(snapshot.analyticsRevisionAtVote, null); assert.equal(snapshot.analyticsConsentAtVote, null);
  assert.equal(snapshot.optionId, second.options[0].id);
  await call("PATCH", "/me/private", actors[1], { analyticsConsent: true });
  assert.equal((await db.pollVote.findUniqueOrThrow({ where: { pollId_voterId: { pollId: second.id, voterId: actors[1].id } } })).genderAtVote, null);
});

test("tercih olayı donmuş seçenek/ürün/zaman kaynağıdır; ham demografi/link veya sonuç taşımaz", async () => {
  const row = await poll(); await vote(row);
  const event = await db.outboxEvent.findFirstOrThrow({ where: { aggregateId: row.id, type: "poll.vote.cast" } });
  const payload = event.payload as Record<string, any>;
  assert.equal(payload.optionId, row.options[0].id); assert.equal(payload.voterId, actors[1].id);
  assert.equal(payload.measurement, "OPTION_PREFERENCE"); assert.equal(payload.visibility, "PUBLIC"); assert.equal(payload.category, "OUTFIT");
  assert.ok(payload.votedAt); assert.equal(event.publishedAt, null);
  for (const key of ["genderAtVote", "ageBandAtVote", "analyticsConsentAtVote", "externalUrl", "totalVotes"]) assert.equal(key in payload, false);
  assert.equal(await db.productTag.count({ where: { optionId: payload.optionId } }), 1);
});

test("izin geri alma olayı yazılamazsa izin ve oy snapshot temizliği birlikte geri alınır", async () => {
  const row = await poll();
  await call("PATCH", "/me/private", actors[1], { gender: "WOMAN", analyticsConsent: true });
  await vote(row);
  const before = await db.pollVote.findUniqueOrThrow({ where: { pollId_voterId: { pollId: row.id, voterId: actors[1].id } } });
  const transaction = db.$transaction.bind(db) as any;
  const eventCreate = db.outboxEvent.create.bind(db.outboxEvent);
  (db as any).$transaction = (work: any, options: any) => transaction(async (tx: any) => {
    tx.outboxEvent.create = async () => { throw new Error("consent event failure"); }; return work(tx);
  }, options);
  try {
    assert.equal((await call("PATCH", "/me/private", actors[1], { analyticsConsent: false })).status, 500);
  } finally {
    (db as any).$transaction = transaction;
    db.outboxEvent.create = eventCreate as typeof db.outboxEvent.create;
  }
  assert.deepEqual(await db.pollVote.findUniqueOrThrow({ where: { pollId_voterId: { pollId: row.id, voterId: actors[1].id } } }), before);
  assert.equal((await call("GET", "/me/private", actors[1])).body.analyticsConsent, true);
  assert.equal((await call("PATCH", "/me/private", actors[1], { analyticsConsent: false })).status, 200);
  assert.equal((await db.pollVote.findUniqueOrThrow({ where: { pollId_voterId: { pollId: row.id, voterId: actors[1].id } } })).genderAtVote, null);
});

test("kapanış tekrar/eşzamanlı taramada tek olay/sürüm üretir; kayıtlı son süreyi korur", async () => {
  const expired = await poll({ expired: true }); const future = await poll();
  const service = app.get(PollParticipationService);
  const results = await Promise.all([service.closeExpiredBatch(100, expired.id), service.closeExpiredBatch(100, expired.id)]);
  assert.equal(results.reduce((sum, item) => sum + item.closed, 0), 1);
  assert.equal((await service.closeExpiredBatch(100, future.id)).closed, 0);
  const saved = await db.poll.findUniqueOrThrow({ where: { id: expired.id } });
  assert.equal(saved.status, "CLOSED"); assert.equal(saved.version, 1); assert.equal(saved.closedAt?.getTime(), expired.closesAt?.getTime());
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: expired.id, type: "poll.closed" } }), 1);
  assert.equal((await vote(expired)).body.error.code, "POLL_EXPIRED");
  assert.equal((await call("GET", `/polls/${expired.id}/results`, actors[2])).body.isFinal, true);
});

test("eşzamanlı aynı tercih tek kayıttır; farklı tercihler yarışınca yalnız biri kabul edilir", async () => {
  const row = await poll();
  const same = await Promise.all([vote(row), vote(row), vote(row)]);
  assert.ok(same.every((item) => item.status === 200)); assert.deepEqual(same[0].body, same[2].body);
  const conflicting = await Promise.all([vote(row, actors[2], 0), vote(row, actors[2], 1)]);
  assert.deepEqual(conflicting.map((item) => item.status).sort(), [200, 409]);
  assert.equal(await db.pollVote.count({ where: { pollId: row.id } }), 2);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: row.id, type: "poll.vote.cast" } }), 2);
});

test("oy/kapanış olayı hata verirse tercih, durum ve sürüm transaction ile geri alınır", async () => {
  const row = await poll(); const expired = await poll({ expired: true });
  const transaction = db.$transaction.bind(db) as any;
  (db as any).$transaction = (work: any, options: any) => transaction(async (tx: any) => {
    tx.outboxEvent.create = async () => { throw new Error("test event failure"); }; return work(tx);
  }, options);
  try {
    assert.equal((await vote(row)).status, 500);
    await assert.rejects(app.get(PollParticipationService).closeExpiredBatch(100, expired.id));
  } finally { (db as any).$transaction = transaction; }
  assert.equal(await db.pollVote.count({ where: { pollId: row.id } }), 0);
  assert.equal((await db.poll.findUniqueOrThrow({ where: { id: row.id } })).version, 0);
  assert.equal((await db.poll.findUniqueOrThrow({ where: { id: expired.id } })).status, "OPEN");
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: { in: polls } } }), 0);
});

test("tarayıcı hatası sonraki çalıştırmayı engellemez; üst üste tick tek taramayı paylaşır", async () => {
  const service = app.get(PollParticipationService);
  const worker = app.get(PollCloseWorker);
  const original = service.closeExpiredBatch.bind(service);
  let scans = 0; let release!: () => void;
  service.closeExpiredBatch = async () => { scans++; await new Promise<void>((resolve) => { release = resolve; }); throw new Error("simulated outage"); };
  try {
    const first = worker.tick(); const second = worker.tick(); release();
    await Promise.all([first, second]); assert.equal(scans, 1);
    service.closeExpiredBatch = async () => { scans++; return { closed: 0 }; };
    await worker.tick(); assert.equal(scans, 2);
  } finally { service.closeExpiredBatch = original; }
});

test("OpenAPI tercih/sonuç ve uygunluk alanlarını belgeler; oy doğal anahtarını kullanır", async () => {
  const schema = (await call("GET", "/openapi.json", null)).body;
  const operation = schema.paths["/v1/polls/{id}/vote"].put;
  assert.ok(operation.security.some((item: any) => "bearer" in item));
  assert.ok(!operation.parameters.some((item: any) => item.name === "Idempotency-Key"));
  assert.ok(schema.paths["/v1/polls/{id}/results"].get);
  for (const field of ["myOptionId", "canVote", "canViewResults"]) assert.ok(schema.components.schemas.PollResponseDto.properties[field]);
});
