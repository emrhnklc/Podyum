import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const { createApp } = await import(new URL("../dist/create-app.js", import.meta.url).href) as { createApp: () => Promise<NestExpressApplication> };
const { PrismaService } = await import(new URL("../dist/database/prisma.service.js", import.meta.url).href);
type Actor = { id: string; token: string };
type PollOptions = { visibility?: "PUBLIC" | "FRIENDS"; expired?: boolean; status?: "OPEN" | "DRAFT"; contentStatus?: "VISIBLE" | "HIDDEN"; publishedSecondsAgo?: number };
let app: NestExpressApplication;
let db: PrismaClient;
let base: string;
let actors: Actor[];
let polls: string[];
const beforeEnv = { NODE_ENV: process.env.NODE_ENV, AUTH_MOCK_ENABLED: process.env.AUTH_MOCK_ENABLED };

async function call(method: string, path: string, actor: Actor | null = actors[0], body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: {
    ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  return { status: response.status, body: await response.json() as any };
}

async function poll(author = actors[0], options: PollOptions = {}) {
  const now = new Date();
  const row = await db.poll.create({ data: { authorId: author.id, question: "Hangisi?", category: "OUTFIT", status: options.status ?? "OPEN",
    visibility: options.visibility ?? "PUBLIC", contentStatus: options.contentStatus ?? "VISIBLE",
    publishedAt: options.status === "DRAFT" ? null : new Date(now.getTime() - (options.publishedSecondsAgo ?? 10) * 1000),
    closesAt: options.status === "DRAFT" ? null : new Date(now.getTime() + (options.expired ? -1000 : 1800000)),
    options: { create: [1, 2].map((position) => ({ position, media: { create: {
      ownerId: author.id, purpose: "POLL", status: "READY", uploadKey: `test-${randomUUID()}`, displayKey: `test-${randomUUID()}`, thumbnailKey: `test-${randomUUID()}`, previewAcceptedAt: now,
    } } })) },
  }, include: { options: { orderBy: { position: "asc" } } } });
  polls.push(row.id);
  return row;
}

type PollRow = Awaited<ReturnType<typeof poll>>;
const key = () => `it-${randomUUID()}`;
const vote = (row: PollRow, actor = actors[1], optionIndex = 0) => call("PUT", `/polls/${row.id}/vote`, actor, { optionId: row.options[optionIndex].id });
const comment = (row: PollRow, actor = actors[1], body = "Bence bu daha iyi") =>
  call("POST", `/polls/${row.id}/comments`, actor, { body }, { "Idempotency-Key": key() });

async function befriend(first: Actor, second: Actor) {
  assert.equal((await call("POST", "/friend-requests", first, { targetUserId: second.id })).status, 200);
  assert.equal((await call("POST", `/friend-requests/${first.id}/accept`, second)).status, 200);
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
    const session = await call("POST", "/auth/mock", null, { provider: "google", subject: `interactions_${randomUUID()}`, acknowledgeMock: true });
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
      const comments = (await tx.comment.findMany({ where: { pollId: { in: polls } }, select: { id: true } })).map((row) => row.id);
      const reports = (await tx.report.findMany({ where: { reporterId: { in: ids } }, select: { id: true } })).map((row) => row.id);
      await tx.outboxEvent.deleteMany({ where: { aggregateId: { in: [...ids, ...polls, ...comments, ...reports] } } });
      await tx.idempotencyRecord.deleteMany({ where: { userId: { in: ids } } });
      await tx.report.deleteMany({ where: { reporterId: { in: ids } } });
      await tx.pollVoteReason.deleteMany({ where: { pollId: { in: polls } } });
      await tx.comment.deleteMany({ where: { pollId: { in: polls } } });
      await tx.pollSave.deleteMany({ where: { pollId: { in: polls } } });
      await tx.pollLike.deleteMany({ where: { pollId: { in: polls } } });
      await tx.pollVote.deleteMany({ where: { pollId: { in: polls } } });
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
    for (const name of Object.keys(beforeEnv) as (keyof typeof beforeEnv)[]) {
      if (beforeEnv[name] === undefined) delete process.env[name]; else process.env[name] = beforeEnv[name];
    }
  }
});

test("etkileşim uçları oturum, UUID, işlem anahtarı ve katı DTO ister", async () => {
  const row = await poll(); await vote(row);
  assert.equal((await call("PUT", `/polls/${row.id}/save`, null)).status, 401);
  assert.equal((await call("GET", "/me/saved-polls", null)).status, 401);
  assert.equal((await call("POST", "/reports", null, { targetType: "POLL", targetId: row.id, reason: "SPAM" })).status, 401);
  assert.equal((await call("PUT", "/polls/not-a-uuid/save", actors[1])).body.error.code, "VALIDATION_ERROR");
  assert.equal((await call("DELETE", "/comments/not-a-uuid", actors[1])).body.error.code, "VALIDATION_ERROR");
  assert.equal((await call("POST", `/polls/${row.id}/comments`, actors[1], { body: "Anahtarsız" })).body.error.code, "IDEMPOTENCY_KEY_REQUIRED");
  for (const body of [{ body: "   " }, { body: "x".repeat(1001) }, { body: "Tamam", authorId: actors[0].id }, {}]) {
    assert.equal((await call("POST", `/polls/${row.id}/comments`, actors[1], body, { "Idempotency-Key": key() })).body.error.code, "VALIDATION_ERROR");
  }
  assert.equal((await call("PUT", `/polls/${row.id}/reason`, actors[1], { reason: "NICE_VIBES" })).body.error.code, "VALIDATION_ERROR");
  assert.equal((await call("PUT", `/polls/${row.id}/reason`, actors[1], { reason: "MORE_STYLISH", optionId: row.options[1].id })).body.error.code, "VALIDATION_ERROR");
  assert.equal((await call("POST", "/reports", actors[1], { targetType: "GAME", targetId: row.id, reason: "SPAM" })).body.error.code, "VALIDATION_ERROR");
  assert.equal((await call("POST", "/reports", actors[1], { targetType: "POLL", targetId: row.id, reason: "SPAM", status: "RESOLVED" })).body.error.code, "VALIDATION_ERROR");
  assert.equal((await call("GET", "/me/saved-polls?limit=51", actors[1])).body.error.code, "VALIDATION_ERROR");
});

test("kaydet/kaldır doğal tekrardır; kaydetmek erişim vermez ve kart durumuna yansır", async () => {
  const row = await poll(); const hidden = await poll(actors[0], { visibility: "FRIENDS" });
  const first = await call("PUT", `/polls/${row.id}/save`, actors[1]);
  assert.equal(first.status, 200); assert.equal(first.body.isSaved, true); assert.ok(first.body.savedAt);
  assert.deepEqual((await call("PUT", `/polls/${row.id}/save`, actors[1])).body, first.body);
  assert.equal(await db.pollSave.count({ where: { pollId: row.id } }), 1);
  assert.equal((await call("GET", "/feed", actors[1])).body.items.find((item: any) => item.id === row.id).isSaved, true);
  assert.equal((await call("GET", "/feed", actors[2])).body.items.find((item: any) => item.id === row.id).isSaved, false);
  assert.equal((await call("PUT", `/polls/${hidden.id}/save`, actors[1])).status, 404);
  assert.equal((await call("PUT", `/polls/${randomUUID()}/save`, actors[1])).status, 404);
  const removed = await call("DELETE", `/polls/${row.id}/save`, actors[1]);
  assert.deepEqual(removed.body, { pollId: row.id, isSaved: false, savedAt: null });
  assert.equal((await call("DELETE", `/polls/${row.id}/save`, actors[1])).status, 200);
  assert.equal((await call("DELETE", `/polls/${randomUUID()}/save`, actors[1])).status, 200);
  assert.equal(await db.pollSave.count({ where: { pollId: row.id } }), 0);
});

test("beğeni doğal tekrardır; tercih oyundan ayrıdır, erişim vermez ve kart sayacına yansır", async () => {
  const row = await poll(); const hidden = await poll(actors[0], { visibility: "FRIENDS" });
  for (const method of ["PUT", "DELETE"]) assert.equal((await call(method, `/polls/${row.id}/like`, null)).status, 401);
  assert.equal((await call("PUT", "/polls/invalid/like", actors[1])).status, 400);
  const first = await call("PUT", `/polls/${row.id}/like`, actors[1]);
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, { pollId: row.id, isLiked: true, likeCount: 1 });
  assert.deepEqual((await call("PUT", `/polls/${row.id}/like`, actors[1])).body, first.body);
  // Sahibi de beğenebilir; beğeni oy, sonuç veya sürüm üretmez.
  assert.equal((await call("PUT", `/polls/${row.id}/like`, actors[0])).body.likeCount, 2);
  const stored = await db.poll.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(stored.version, row.version);
  assert.equal(await db.pollVote.count({ where: { pollId: row.id } }), 0);
  const card = (actor: Actor) => call("GET", "/feed", actor).then((result) => result.body.items.find((item: any) => item.id === row.id));
  assert.deepEqual([(await card(actors[1])).likeCount, (await card(actors[1])).isLiked], [2, true]);
  assert.deepEqual([(await card(actors[2])).likeCount, (await card(actors[2])).isLiked], [2, false]);
  // Engellenen kullanıcının beğenisi izleyicinin sayacında görünmez.
  assert.equal((await call("PUT", `/blocks/${actors[1].id}`, actors[2])).status, 200);
  assert.equal((await card(actors[2])).likeCount, 1);
  assert.equal((await call("PUT", `/polls/${hidden.id}/like`, actors[1])).status, 404);
  assert.equal((await call("PUT", `/polls/${randomUUID()}/like`, actors[1])).status, 404);
  assert.deepEqual((await call("DELETE", `/polls/${row.id}/like`, actors[1])).body, { pollId: row.id, isLiked: false, likeCount: 1 });
  assert.equal((await call("DELETE", `/polls/${row.id}/like`, actors[1])).status, 200);
  assert.deepEqual((await call("DELETE", `/polls/${hidden.id}/like`, actors[1])).body, { pollId: hidden.id, isLiked: false, likeCount: 0 });
  assert.equal(await db.pollLike.count({ where: { pollId: row.id } }), 1);
});

test("kaydedilenler yalnız hâlâ görünen yayınları kişiye özel cursor ile sayfalar", async () => {
  const rows = [await poll(), await poll(), await poll()];
  await vote(rows[0], actors[1], 1);
  for (const [index, row] of rows.entries()) {
    assert.equal((await call("PUT", `/polls/${row.id}/save`, actors[1])).status, 200);
    await db.pollSave.update({ where: { pollId_userId: { pollId: row.id, userId: actors[1].id } }, data: { createdAt: new Date(Date.now() - (3 - index) * 60000) } });
  }
  const first = await call("GET", "/me/saved-polls?limit=2", actors[1]);
  assert.deepEqual(first.body.items.map((item: any) => item.id), [rows[2].id, rows[1].id]);
  assert.ok(first.body.items.every((item: any) => item.isSaved && item.savedAt)); assert.ok(first.body.nextCursor);
  const second = await call("GET", `/me/saved-polls?limit=2&cursor=${first.body.nextCursor}`, actors[1]);
  assert.deepEqual(second.body.items.map((item: any) => item.id), [rows[0].id]);
  assert.equal(second.body.items[0].myOptionId, rows[0].options[1].id); assert.equal(second.body.nextCursor, null);
  assert.equal((await call("GET", `/me/saved-polls?cursor=${first.body.nextCursor}`, actors[2])).body.error.code, "INVALID_CURSOR");
  assert.deepEqual((await call("GET", "/me/saved-polls", actors[2])).body.items, []);
  await db.poll.update({ where: { id: rows[2].id }, data: { contentStatus: "HIDDEN" } });
  await db.poll.update({ where: { id: rows[1].id }, data: { visibility: "FRIENDS" } });
  assert.deepEqual((await call("GET", "/me/saved-polls", actors[1])).body.items.map((item: any) => item.id), [rows[0].id]);
  // Erişimi kapanan kayıt silinmez; yalnız listelenmez ve kaldırılabilir.
  assert.equal(await db.pollSave.count({ where: { userId: actors[1].id } }), 3);
  assert.equal((await call("DELETE", `/polls/${rows[2].id}/save`, actors[1])).status, 200);
});

test("yalnız oy veren ve paylaşım sahibi yorum yazar; liste yazar özetini ve yetki ipuçlarını döndürür", async () => {
  const row = await poll();
  assert.equal((await comment(row, actors[1])).body.error.code, "COMMENT_REQUIRES_VOTE");
  assert.equal((await call("GET", `/polls/${row.id}/comments`, actors[1])).body.canComment, false);
  await vote(row);
  const created = await comment(row, actors[1], "  Renkler çok uyumlu  ");
  assert.equal(created.status, 201);
  assert.deepEqual(Object.keys(created.body).sort(), ["createdAt", "id", "pollId"]);
  assert.equal((await comment(row, actors[0], "Teşekkürler")).status, 201);
  const list = await call("GET", `/polls/${row.id}/comments`, actors[1]);
  assert.equal(list.status, 200); assert.equal(list.body.commentsEnabled, true); assert.equal(list.body.canComment, true);
  assert.deepEqual(list.body.items.map((item: any) => item.body), ["Teşekkürler", "Renkler çok uyumlu"]);
  const mine = list.body.items[1];
  assert.deepEqual(Object.keys(mine).sort(), ["author", "body", "canRemove", "createdAt", "id", "isMine", "pollId"]);
  assert.deepEqual(Object.keys(mine.author).sort(), ["avatarPath", "displayName", "id", "username"]);
  assert.equal(mine.author.id, actors[1].id); assert.equal(mine.isMine, true); assert.equal(mine.canRemove, true);
  assert.equal(list.body.items[0].isMine, false); assert.equal(list.body.items[0].canRemove, false);
  const owner = await call("GET", `/polls/${row.id}/comments`, actors[0]);
  assert.ok(owner.body.items.every((item: any) => item.canRemove));
  // Oy vermeyen kişi yorumları okuyabilir ama yazamaz; sayaç akış kartına yansır.
  const reader = await call("GET", `/polls/${row.id}/comments`, actors[2]);
  assert.equal(reader.body.items.length, 2); assert.equal(reader.body.canComment, false);
  assert.equal((await call("GET", "/feed", actors[2])).body.items.find((item: any) => item.id === row.id).commentCount, 2);
  assert.equal((await db.poll.findUniqueOrThrow({ where: { id: row.id } })).version, 1, "yorum oylama sürümünü değiştirmez; yalnız oy artırdı");
});

test("yorum işlem anahtarı tekrarında tek kayıt; farklı gövde çatışır ve makbuz metin saklamaz", async () => {
  const row = await poll(); await vote(row);
  const headers = { "Idempotency-Key": key() };
  const first = await call("POST", `/polls/${row.id}/comments`, actors[1], { body: "Tek yorum" }, headers);
  const repeat = await call("POST", `/polls/${row.id}/comments`, actors[1], { body: "Tek yorum" }, headers);
  assert.equal(first.status, 201); assert.deepEqual(repeat.body, first.body);
  assert.equal(await db.comment.count({ where: { pollId: row.id } }), 1);
  assert.equal((await call("POST", `/polls/${row.id}/comments`, actors[1], { body: "Başka yorum" }, headers)).body.error.code, "IDEMPOTENCY_KEY_REUSED");
  const record = await db.idempotencyRecord.findFirstOrThrow({ where: { userId: actors[1].id, key: headers["Idempotency-Key"] } });
  assert.ok(!JSON.stringify(record.responseBody).includes("Tek yorum"));
  const events = await db.outboxEvent.findMany({ where: { aggregateId: first.body.id } });
  assert.equal(events.length, 1); assert.equal(events[0].type, "poll.comment.created"); assert.equal(events[0].aggregateType, "comment");
  assert.ok(!JSON.stringify(events[0].payload).includes("Tek yorum"));
  assert.equal((events[0].payload as any).pollAuthorId, actors[0].id);
});

test("yorumlar kapalıyken yeni yorum reddedilir, eski yorumlar okunur", async () => {
  const row = await poll(); await vote(row);
  assert.equal((await comment(row)).status, 201);
  await db.poll.update({ where: { id: row.id }, data: { commentsEnabled: false } });
  assert.equal((await comment(row)).body.error.code, "COMMENTS_DISABLED");
  assert.equal((await comment(row, actors[0])).body.error.code, "COMMENTS_DISABLED");
  const list = await call("GET", `/polls/${row.id}/comments`, actors[1]);
  assert.equal(list.body.items.length, 1); assert.equal(list.body.commentsEnabled, false); assert.equal(list.body.canComment, false);
  // Kapanmış oylamada yorumlar açıksa oy vermiş kişi yazmaya devam eder.
  await db.poll.update({ where: { id: row.id }, data: { commentsEnabled: true, closesAt: new Date(Date.now() - 1000) } });
  assert.equal((await comment(row)).status, 201);
  assert.equal((await comment(row, actors[2])).body.error.code, "COMMENT_REQUIRES_VOTE");
});

test("yorumu yazan veya paylaşım sahibi kaldırır; başkası göremez, tekrar aynı sonuçtur", async () => {
  const row = await poll(); await vote(row, actors[1]); await vote(row, actors[2]);
  const first = (await comment(row, actors[1], "Birinci")).body; const second = (await comment(row, actors[2], "İkinci")).body;
  assert.equal((await call("DELETE", `/comments/${first.id}`, actors[2])).status, 404);
  assert.equal((await call("DELETE", `/comments/${randomUUID()}`, actors[1])).status, 404);
  assert.deepEqual((await call("DELETE", `/comments/${first.id}`, actors[1])).body, { id: first.id, removed: true });
  assert.deepEqual((await call("DELETE", `/comments/${first.id}`, actors[1])).body, { id: first.id, removed: true });
  assert.deepEqual((await call("DELETE", `/comments/${second.id}`, actors[0])).body, { id: second.id, removed: true });
  const saved = await db.comment.findMany({ where: { pollId: row.id }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(saved.map((item) => [item.contentStatus, item.removedById]), [["REMOVED", actors[1].id], ["REMOVED", actors[0].id]]);
  assert.ok(saved.every((item) => item.removedAt));
  assert.deepEqual((await call("GET", `/polls/${row.id}/comments`, actors[1])).body.items, []);
  assert.equal((await call("GET", `/polls/${row.id}`, actors[3])).status, 200);
  assert.equal((await call("GET", "/feed", actors[3])).body.items.find((item: any) => item.id === row.id).commentCount, 0);
  const removals = await db.outboxEvent.findMany({ where: { aggregateId: { in: [first.id, second.id] }, type: "poll.comment.removed" }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(removals.map((event) => (event.payload as any).byPollOwner), [false, true]);
  // Kaldırılmış yorum metni yerine yenisi yazılabilir; düzenleme ucu yoktur.
  assert.equal((await call("PATCH", `/comments/${first.id}`, actors[1], { body: "Düzeltme" })).status, 404);
  assert.equal((await comment(row, actors[1], "Yeniden")).status, 201);
});

test("engel, hesap durumu ve özel görünürlük yorum okuma/yazmayı kapatır", async () => {
  const row = await poll(); await vote(row, actors[1]); await vote(row, actors[2]);
  await comment(row, actors[1], "Engellenecek"); await comment(row, actors[2], "Askıya alınacak");
  assert.equal((await call("PUT", `/blocks/${actors[1].id}`, actors[3])).status, 200);
  assert.deepEqual((await call("GET", `/polls/${row.id}/comments`, actors[3])).body.items.map((item: any) => item.body), ["Askıya alınacak"]);
  await db.user.update({ where: { id: actors[2].id }, data: { status: "SUSPENDED" } });
  assert.deepEqual((await call("GET", `/polls/${row.id}/comments`, actors[3])).body.items, []);
  assert.deepEqual((await call("GET", `/polls/${row.id}/comments`, actors[0])).body.items.map((item: any) => item.body), ["Engellenecek"]);
  // Paylaşım sahibi oy vereni engellerse eski oyu toplamda kalır ama yorum/okuma kapanır.
  assert.equal((await call("PUT", `/blocks/${actors[1].id}`, actors[0])).status, 200);
  assert.equal((await comment(row, actors[1])).status, 404);
  assert.equal((await call("GET", `/polls/${row.id}/comments`, actors[1])).status, 404);
  assert.equal(await db.pollVote.count({ where: { pollId: row.id } }), 2);
  const closed = await poll(actors[0], { visibility: "FRIENDS" });
  assert.equal((await call("GET", `/polls/${closed.id}/comments`, actors[3])).status, 404);
  assert.equal((await comment(closed, actors[3])).status, 404);
});

test("yorumlar yeniden eskiye sayfalanır; cursor oylama ve izleyiciye bağlıdır", async () => {
  const row = await poll(); const other = await poll(); await vote(row);
  const base = Date.now() - 600000;
  await db.comment.createMany({ data: [0, 1, 2].map((index) => ({ pollId: row.id, authorId: actors[1].id, body: `Yorum ${index}`, createdAt: new Date(base + index * 1000) })) });
  const first = await call("GET", `/polls/${row.id}/comments?limit=2`, actors[1]);
  assert.deepEqual(first.body.items.map((item: any) => item.body), ["Yorum 2", "Yorum 1"]); assert.ok(first.body.nextCursor);
  const second = await call("GET", `/polls/${row.id}/comments?limit=2&cursor=${first.body.nextCursor}`, actors[1]);
  assert.deepEqual(second.body.items.map((item: any) => item.body), ["Yorum 0"]); assert.equal(second.body.nextCursor, null);
  assert.equal((await call("GET", `/polls/${other.id}/comments?cursor=${first.body.nextCursor}`, actors[1])).body.error.code, "INVALID_CURSOR");
  assert.equal((await call("GET", `/polls/${row.id}/comments?cursor=${first.body.nextCursor}`, actors[2])).body.error.code, "INVALID_CURSOR");
});

test("aynı paylaşıma 24 saatte en fazla 30 yorum; eski yorumlar sınırı doldurmaz", async () => {
  const row = await poll(); await vote(row);
  await db.comment.createMany({ data: Array.from({ length: 29 }, () => ({ pollId: row.id, authorId: actors[1].id, body: "Dolgu" })) });
  await db.comment.create({ data: { pollId: row.id, authorId: actors[1].id, body: "Eski", createdAt: new Date(Date.now() - 2 * 86400000) } });
  assert.equal((await comment(row)).status, 201);
  assert.equal((await comment(row)).body.error.code, "COMMENT_RATE_LIMITED");
  assert.equal(await db.comment.count({ where: { pollId: row.id } }), 31);
});

test("neden oy ister; kişi başına tek kayıt, değiştirilebilir ve kaldırılabilir", async () => {
  const row = await poll();
  assert.equal((await call("PUT", `/polls/${row.id}/reason`, actors[1], { reason: "MORE_STYLISH" })).body.error.code, "VOTE_REQUIRED");
  assert.equal((await call("PUT", `/polls/${row.id}/reason`, actors[0], { reason: "MORE_STYLISH" })).body.error.code, "VOTE_REQUIRED");
  await vote(row, actors[1], 1);
  const first = await call("PUT", `/polls/${row.id}/reason`, actors[1], { reason: "MORE_STYLISH" });
  assert.equal(first.status, 200); assert.equal(first.body.optionId, row.options[1].id); assert.equal(first.body.reason, "MORE_STYLISH");
  const changed = await call("PUT", `/polls/${row.id}/reason`, actors[1], { reason: "COLOR_HARMONY" });
  assert.equal(changed.body.reason, "COLOR_HARMONY");
  assert.equal(await db.pollVoteReason.count({ where: { pollId: row.id } }), 1);
  // Neden oyu, sonucu veya oylama sürümünü değiştirmez.
  assert.equal(await db.pollVote.count({ where: { pollId: row.id } }), 1);
  assert.equal((await db.poll.findUniqueOrThrow({ where: { id: row.id } })).version, 1);
  const cleared = await call("DELETE", `/polls/${row.id}/reason`, actors[1]);
  assert.deepEqual(cleared.body, { pollId: row.id, optionId: row.options[1].id, reason: null, updatedAt: null });
  assert.equal((await call("DELETE", `/polls/${row.id}/reason`, actors[1])).status, 200);
  assert.equal((await call("DELETE", `/polls/${row.id}/reason`, actors[2])).body.optionId, null);
  assert.equal(await db.pollVoteReason.count({ where: { pollId: row.id } }), 0);
  const closed = await poll(actors[0], { visibility: "FRIENDS" });
  assert.equal((await call("PUT", `/polls/${closed.id}/reason`, actors[1], { reason: "BETTER_FIT" })).status, 404);
});

test("neden sayıları seçenek başınadır; görünürlük sonuçla aynıdır", async () => {
  const row = await poll();
  await vote(row, actors[1], 0); await vote(row, actors[2], 0); await vote(row, actors[3], 1);
  await call("PUT", `/polls/${row.id}/reason`, actors[1], { reason: "COLOR_HARMONY" });
  await call("PUT", `/polls/${row.id}/reason`, actors[2], { reason: "COLOR_HARMONY" });
  await call("PUT", `/polls/${row.id}/reason`, actors[3], { reason: "MORE_COMFORTABLE" });
  const other = await poll(); const stranger = await call("GET", `/polls/${other.id}/reasons`, actors[1]);
  assert.equal(stranger.body.error.code, "RESULTS_NOT_AVAILABLE");
  const seen = await call("GET", `/polls/${row.id}/reasons`, actors[1]);
  assert.equal(seen.status, 200); assert.equal(seen.body.myReason, "COLOR_HARMONY");
  assert.deepEqual(seen.body.options.map((option: any) => option.label), ["A", "B"]);
  const codes = ["COLOR_HARMONY", "MORE_STYLISH", "MORE_COMFORTABLE", "FITS_OCCASION", "BETTER_FIT"];
  assert.deepEqual(seen.body.options[0].reasons.map((item: any) => item.code), codes);
  assert.deepEqual(seen.body.options[0].reasons.map((item: any) => item.count), [2, 0, 0, 0, 0]);
  assert.deepEqual(seen.body.options[1].reasons.map((item: any) => item.count), [0, 0, 1, 0, 0]);
  const owner = await call("GET", `/polls/${row.id}/reasons`, actors[0]);
  assert.equal(owner.status, 200); assert.equal(owner.body.myReason, null);
  // Yanıt kimin hangi nedeni seçtiğini taşımaz.
  assert.ok(!JSON.stringify(owner.body).includes(actors[1].id));
  await db.poll.update({ where: { id: other.id }, data: { closesAt: new Date(Date.now() - 1000) } });
  assert.equal((await call("GET", `/polls/${other.id}/reasons`, actors[1])).status, 200);
});

test("başkasının paylaşımları yalnız izleyicinin görebildiği yayınlardır", async () => {
  const open = await poll(actors[0], { publishedSecondsAgo: 30 }); const friendsOnly = await poll(actors[0], { visibility: "FRIENDS", publishedSecondsAgo: 20 });
  const ended = await poll(actors[0], { expired: true, publishedSecondsAgo: 10 });
  await poll(actors[0], { status: "DRAFT" }); await poll(actors[0], { contentStatus: "HIDDEN" }); await poll(actors[1]);
  const stranger = await call("GET", `/users/${actors[0].id}/polls`, actors[2]);
  assert.equal(stranger.status, 200);
  assert.deepEqual(stranger.body.items.map((item: any) => item.id), [ended.id, open.id]);
  assert.equal(stranger.body.items[0].effectiveStatus, "CLOSED");
  await befriend(actors[0], actors[1]); await vote(open, actors[1], 1);
  const friend = await call("GET", `/users/${actors[0].id}/polls?limit=2`, actors[1]);
  assert.deepEqual(friend.body.items.map((item: any) => item.id), [ended.id, friendsOnly.id]); assert.ok(friend.body.nextCursor);
  const rest = await call("GET", `/users/${actors[0].id}/polls?limit=2&cursor=${friend.body.nextCursor}`, actors[1]);
  assert.deepEqual(rest.body.items.map((item: any) => item.id), [open.id]);
  assert.equal(rest.body.items[0].myOptionId, open.options[1].id); assert.equal(rest.body.items[0].totalVotes, 1);
  assert.equal((await call("GET", `/users/${actors[0].id}/polls?cursor=${friend.body.nextCursor}`, actors[2])).body.error.code, "INVALID_CURSOR");
  // Sahibi kendi listesinde taslak görmez; taslaklar /me/polls ucundadır.
  assert.equal((await call("GET", `/users/${actors[0].id}/polls`, actors[0])).body.items.length, 3);
  assert.equal((await call("PUT", `/blocks/${actors[2].id}`, actors[0])).status, 200);
  assert.equal((await call("GET", `/users/${actors[0].id}/polls`, actors[2])).status, 404);
  assert.equal((await call("GET", `/users/${randomUUID()}/polls`, actors[2])).status, 404);
});

test("şikâyet görünen paylaşım, yorum ve kullanıcı içindir; tekrar ilk kaydı döndürür", async () => {
  const row = await poll(); await vote(row); const written = (await comment(row, actors[1], "Şikâyet edilecek")).body;
  const first = await call("POST", "/reports", actors[2], { targetType: "POLL", targetId: row.id, reason: "INAPPROPRIATE", note: "  Uygunsuz görsel  " });
  assert.equal(first.status, 201);
  assert.deepEqual(Object.keys(first.body).sort(), ["createdAt", "id", "reason", "status", "targetId", "targetType"]);
  assert.equal(first.body.status, "OPEN"); assert.equal(first.body.targetId, row.id);
  const repeat = await call("POST", "/reports", actors[2], { targetType: "POLL", targetId: row.id, reason: "SPAM" });
  assert.equal(repeat.body.id, first.body.id); assert.equal(repeat.body.reason, "INAPPROPRIATE");
  assert.equal((await db.report.findUniqueOrThrow({ where: { id: first.body.id } })).note, "Uygunsuz görsel");
  assert.equal((await call("POST", "/reports", actors[2], { targetType: "COMMENT", targetId: written.id, reason: "HARASSMENT" })).status, 201);
  assert.equal((await call("POST", "/reports", actors[2], { targetType: "USER", targetId: actors[1].id, reason: "IMPERSONATION" })).status, 201);
  const stored = await db.report.findMany({ where: { reporterId: actors[2].id }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(stored.map((item) => [item.targetType, item.pollId, item.commentId, item.targetUserId]),
    [["POLL", row.id, null, null], ["COMMENT", null, written.id, null], ["USER", null, null, actors[1].id]]);
  // Kendi içeriği, olmayan veya görülemeyen hedef.
  assert.equal((await call("POST", "/reports", actors[0], { targetType: "POLL", targetId: row.id, reason: "SPAM" })).body.error.code, "SELF_REPORT_NOT_ALLOWED");
  assert.equal((await call("POST", "/reports", actors[1], { targetType: "COMMENT", targetId: written.id, reason: "SPAM" })).body.error.code, "SELF_REPORT_NOT_ALLOWED");
  assert.equal((await call("POST", "/reports", actors[1], { targetType: "USER", targetId: actors[1].id, reason: "SPAM" })).body.error.code, "SELF_REPORT_NOT_ALLOWED");
  assert.equal((await call("POST", "/reports", actors[2], { targetType: "POLL", targetId: written.id, reason: "SPAM" })).status, 404);
  const closed = await poll(actors[0], { visibility: "FRIENDS" });
  assert.equal((await call("POST", "/reports", actors[2], { targetType: "POLL", targetId: closed.id, reason: "SPAM" })).status, 404);
  // Engellediğin kişiyi şikâyet edebilirsin; seni engelleyen kişi görünmez.
  assert.equal((await call("PUT", `/blocks/${actors[0].id}`, actors[3])).status, 200);
  assert.equal((await call("POST", "/reports", actors[3], { targetType: "USER", targetId: actors[0].id, reason: "HARASSMENT" })).status, 201);
  assert.equal((await call("POST", "/reports", actors[0], { targetType: "USER", targetId: actors[3].id, reason: "HARASSMENT" })).status, 404);
  // Olay açıklama metnini taşımaz; şikâyet içeriği kendiliğinden gizlemez.
  const event = await db.outboxEvent.findFirstOrThrow({ where: { aggregateId: first.body.id } });
  assert.equal(event.type, "report.created"); assert.ok(!JSON.stringify(event.payload).includes("Uygunsuz"));
  assert.ok((await call("GET", "/feed", actors[2])).body.items.some((item: any) => item.id === row.id));
  assert.equal((await call("GET", `/polls/${row.id}/comments`, actors[2])).body.items.length, 1);
});

test("günde en fazla 50 şikâyet; hedef bütünlüğü veritabanında da korunur", async () => {
  const row = await poll(); await vote(row);
  const ids = Array.from({ length: 50 }, () => randomUUID());
  await db.comment.createMany({ data: ids.map((id) => ({ id, pollId: row.id, authorId: actors[1].id, body: "Hedef" })) });
  await db.report.createMany({ data: ids.map((commentId) => ({ reporterId: actors[2].id, targetType: "COMMENT" as const, commentId, reason: "SPAM" as const })) });
  assert.equal((await call("POST", "/reports", actors[2], { targetType: "POLL", targetId: row.id, reason: "SPAM" })).body.error.code, "REPORT_RATE_LIMITED");
  // Sınır doluyken daha önce bildirilen hedef yine ilk kaydı döndürür.
  assert.equal((await call("POST", "/reports", actors[2], { targetType: "COMMENT", targetId: ids[0], reason: "OTHER" })).status, 201);
  await assert.rejects(db.report.create({ data: { reporterId: actors[3].id, targetType: "POLL", commentId: ids[0], reason: "SPAM" } }));
  await assert.rejects(db.report.create({ data: { reporterId: actors[3].id, targetType: "USER", targetUserId: actors[3].id, reason: "SPAM" } }));
  await assert.rejects(db.comment.update({ where: { id: ids[0] }, data: { removedAt: new Date() } }));
});

test("OpenAPI etkileşim ve şikâyet uçlarını belgeler; yalnız yorum oluşturma işlem anahtarı ister", async () => {
  const schema = (await call("GET", "/openapi.json", null)).body;
  const paths = schema.paths;
  assert.ok(paths["/v1/polls/{id}/comments"].post.parameters.some((item: any) => item.name === "Idempotency-Key" && item.required));
  for (const operation of [paths["/v1/polls/{id}/save"].put, paths["/v1/polls/{id}/save"].delete, paths["/v1/comments/{id}"].delete,
    paths["/v1/polls/{id}/like"].put, paths["/v1/polls/{id}/like"].delete,
    paths["/v1/polls/{id}/reason"].put, paths["/v1/polls/{id}/reason"].delete, paths["/v1/reports"].post]) {
    assert.ok(operation.security.some((item: any) => "bearer" in item));
    assert.ok(!(operation.parameters ?? []).some((item: any) => item.name === "Idempotency-Key"));
  }
  for (const path of ["/v1/me/saved-polls", "/v1/users/{id}/polls", "/v1/polls/{id}/comments", "/v1/polls/{id}/reasons"]) assert.ok(paths[path].get);
  for (const field of ["totalVotes", "commentCount", "isSaved", "likeCount", "isLiked"]) assert.ok(schema.components.schemas.PollCardDto.properties[field]);
  assert.ok(!schema.components.schemas.CommentReceiptDto.properties.body);
  assert.deepEqual(schema.components.schemas.SetPollReasonDto.properties.reason.enum,
    ["COLOR_HARMONY", "MORE_STYLISH", "MORE_COMFORTABLE", "FITS_OCCASION", "BETTER_FIT"]);
  assert.ok(!paths["/v1/comments/{id}"].patch, "yorum düzenleme ucu yok");
});
