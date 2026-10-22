import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client.js";

const { createApp } = await import(new URL("../dist/create-app.js", import.meta.url).href) as { createApp: () => Promise<NestExpressApplication> };
const { PrismaService } = await import(new URL("../dist/database/prisma.service.js", import.meta.url).href);
type Actor = { id: string; token: string };
let app: NestExpressApplication;
let db: PrismaClient;
let base: string;
let actors: Actor[];
let polls: string[];
const originalEnv = { NODE_ENV: process.env.NODE_ENV, AUTH_MOCK_ENABLED: process.env.AUTH_MOCK_ENABLED };

async function call(method: string, path: string, actor: Actor | null = actors[1], body?: unknown) {
  const response = await fetch(`${base}${path}`, { method, headers: {
    ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  return { status: response.status, body: await response.json() as any, headers: response.headers };
}

async function poll(author = actors[0], fields: Partial<Prisma.PollUncheckedCreateInput> = {}) {
  const now = new Date();
  const row = await db.poll.create({ data: {
    authorId: author.id, question: "Hangisi?", category: "TATTOO", status: "OPEN", visibility: "PUBLIC",
    publishedAt: new Date(now.getTime() - 10000), closesAt: new Date(now.getTime() + 1800000),
    ...fields,
    options: { create: [1, 2].map((position) => ({ position, media: { create: {
      ownerId: author.id, purpose: "POLL", status: "READY", uploadKey: `test-${randomUUID()}`,
      displayKey: `test-${randomUUID()}`, thumbnailKey: `test-${randomUUID()}`, previewAcceptedAt: now, width: 500, height: 700,
    } }, products: { create: { title: "Kullanıcı ürünü", brand: "Beyan", priceMinor: 12300,
      priceRecordedAt: now, externalUrl: "https://example.com/item?ref=original" } } })) },
  }, include: { options: { orderBy: { position: "asc" } } } });
  polls.push(row.id);
  return row;
}

async function befriend(author = actors[0], viewer = actors[1]) {
  const request = await call("POST", "/friend-requests", author, { targetUserId: viewer.id });
  assert.ok([200, 201].includes(request.status), JSON.stringify(request.body));
  assert.equal((await call("POST", `/friend-requests/${author.id}/accept`, viewer)).status, 200);
}

const fixtureIds = (body: any) => body.items.filter((item: any) => polls.includes(item.id)).map((item: any) => item.id) as string[];
const feed = (query = "", viewer = actors[1]) => call("GET", `/feed?category=TATTOO${query}`, viewer);

beforeEach(async () => {
  process.env.NODE_ENV = "test"; process.env.AUTH_MOCK_ENABLED = "true";
  actors = []; polls = [];
  app = await createApp(); await app.listen(0, "127.0.0.1");
  base = `${await app.getUrl()}/v1`; db = app.get(PrismaService);
  for (let index = 0; index < 4; index++) {
    const session = await call("POST", "/auth/mock", null, { provider: "google", subject: `feed_${randomUUID()}`, acknowledgeMock: true });
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
      await tx.comment.deleteMany({ where: { pollId: { in: polls } } });
      await tx.pollSave.deleteMany({ where: { pollId: { in: polls } } });
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
    for (const key of Object.keys(originalEnv) as (keyof typeof originalEnv)[]) {
      if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
    }
  }
});

test("akış oturum ve katı filtre/limit/cursor doğrulaması ister", async () => {
  assert.equal((await call("GET", "/feed", null)).status, 401);
  for (const query of ["scope=all", "scope=EVERYONE", "scope=", "scope[]=friends", "category=all", "category=", "category=TATTOO&category=BAG", "limit=0", "limit=51", "limit=1.5", "limit=-1", "cursor=", "cursor=broken", "viewerId=spoofed", "offset=10"]) {
    assert.equal((await call("GET", `/feed?${query}`)).status, 400, query);
  }
  assert.equal((await call("GET", "/feed?limit=50")).status, 200);
  await db.user.update({ where: { id: actors[1].id }, data: { status: "SUSPENDED" } });
  assert.equal((await call("GET", "/feed")).status, 403);
});

test("herkes PUBLIC ve kabul edilmiş arkadaşların FRIENDS yayınlarını gösterir; arkadaşlar yazarı da filtreler", async () => {
  await befriend(); await befriend(actors[1], actors[2]);
  const friendPublic = await poll(); const friendPrivate = await poll(actors[0], { visibility: "FRIENDS" });
  const secondFriend = await poll(actors[2], { visibility: "FRIENDS" });
  const otherPublic = await poll(actors[3]); await poll(actors[3], { visibility: "FRIENDS" }); await poll(actors[1]);
  const everyone = await feed();
  assert.equal(everyone.status, 200);
  assert.deepEqual(new Set(fixtureIds(everyone.body)), new Set([friendPublic.id, friendPrivate.id, secondFriend.id, otherPublic.id]));
  assert.deepEqual(new Set(fixtureIds((await feed("&scope=friends")).body)), new Set([friendPublic.id, friendPrivate.id, secondFriend.id]));
  assert.deepEqual(fixtureIds((await feed("&scope=friends", actors[3])).body), []);
});

test("bekleyen ve reddedilen arkadaşlık özel içeriğe veya arkadaş akışına yetmez", async () => {
  await poll(actors[0], { visibility: "FRIENDS" }); const publicPoll = await poll();
  await call("POST", "/friend-requests", actors[0], { targetUserId: actors[1].id });
  assert.deepEqual(fixtureIds((await feed()).body), [publicPoll.id]);
  assert.deepEqual((await feed("&scope=friends")).body.items, []);
  assert.equal((await call("POST", `/friend-requests/${actors[0].id}/decline`)).status, 200);
  assert.deepEqual(fixtureIds((await feed()).body), [publicPoll.id]);
  assert.deepEqual((await feed("&scope=friends")).body.items, []);
});

test("kendi/taslak/iptal/kapalı/süresi dolmuş/gizli/kaldırılmış ve pasif yazarlı içerik akışa girmez", async () => {
  const visible = await poll(); await poll(actors[1]);
  await poll(actors[0], { status: "DRAFT", publishedAt: null, closesAt: null });
  await poll(actors[0], { status: "CANCELLED", closedAt: new Date() });
  await poll(actors[0], { status: "CLOSED", closedAt: new Date(), closesAt: new Date(Date.now() - 1000) });
  const expired = await poll(actors[0], { closesAt: new Date(Date.now() - 1000) });
  await poll(actors[0], { contentStatus: "HIDDEN" }); await poll(actors[0], { contentStatus: "REMOVED" });
  await poll(actors[2]); await db.user.update({ where: { id: actors[2].id }, data: { status: "SUSPENDED" } });
  await poll(actors[3]); await db.user.update({ where: { id: actors[3].id }, data: { status: "DELETED" } });
  assert.deepEqual(fixtureIds((await feed()).body), [visible.id]);
  const detail = await call("GET", `/polls/${expired.id}`);
  assert.equal(detail.status, 200); assert.equal(detail.body.effectiveStatus, "CLOSED"); assert.equal(detail.body.canViewResults, true);
  assert.equal((await db.poll.findUniqueOrThrow({ where: { id: expired.id } })).status, "OPEN");
});

test("henüz desteklenmeyen hedefli oylama akışta oy verilebilir gibi gösterilmez", async () => {
  const normal = await poll();
  await poll(actors[0], { audienceGender: "WOMEN" }); await poll(actors[0], { audienceAgeBand: "AGE_18_24" }); await poll(actors[0], { styleMatchRequired: true });
  assert.deepEqual(fixtureIds((await feed()).body), [normal.id]);
});

test("tercih yalnız oy verenin akışından çıkar; detay ve sonuçlar çalışmaya devam eder", async () => {
  const row = await poll(); assert.ok(fixtureIds((await feed()).body).includes(row.id));
  assert.equal((await call("PUT", `/polls/${row.id}/vote`, actors[1], { optionId: row.options[0].id })).status, 200);
  assert.ok(!fixtureIds((await feed()).body).includes(row.id));
  assert.ok(fixtureIds((await feed("", actors[2])).body).includes(row.id));
  const detail = (await call("GET", `/polls/${row.id}`)).body;
  assert.equal(detail.myOptionId, row.options[0].id); assert.equal(detail.canVote, false); assert.equal(detail.canViewResults, true);
  assert.equal((await call("GET", `/polls/${row.id}/results`)).body.totalVotes, 1);
  assert.equal(await db.pointsLedger.count({ where: { userId: actors[1].id } }), 0);
});

test("kategori filtresi tümünü daraltır; sonuç yoksa items boş ve nextCursor null", async () => {
  await befriend(); const outfit = await poll(actors[0], { category: "OUTFIT" }); const shoe = await poll(actors[0], { category: "SHOES" });
  assert.deepEqual(new Set(fixtureIds((await call("GET", "/feed?scope=friends")).body)), new Set([outfit.id, shoe.id]));
  assert.deepEqual(fixtureIds((await call("GET", "/feed?scope=friends&category=SHOES")).body), [shoe.id]);
  const empty = await feed("&scope=friends");
  assert.deepEqual(empty.body.items, []); assert.equal(empty.body.nextCursor, null); assert.ok(empty.body.serverNow);
});

test("publishedAt/id keyset sayfalama eşit zamanda kararlı; yeni yayın ve değişen sınır kaydı tekrar/atlama üretmez", async () => {
  await befriend(); const publishedAt = new Date(Date.now() - 10000);
  const rows = [];
  for (let index = 0; index < 6; index++) rows.push(await poll(actors[0], { publishedAt, createdAt: new Date(Date.now() - (index + 1) * 20000) }));
  const expected = rows.map((row) => row.id).sort().reverse();
  const first = await feed("&scope=friends&limit=1");
  assert.deepEqual(fixtureIds(first.body), [expected[0]]); assert.ok(first.body.nextCursor);
  const newer = await poll(actors[0], { publishedAt: new Date(Date.now() - 1000) });
  assert.equal((await feed("&scope=friends&limit=1")).body.items[0].id, newer.id);
  await db.poll.update({ where: { id: expected[0] }, data: { status: "CANCELLED", closedAt: new Date() } });
  const seen = [...fixtureIds(first.body)]; let cursor = first.body.nextCursor;
  while (cursor) {
    const page = await feed(`&scope=friends&limit=2&cursor=${cursor}`);
    assert.equal(page.status, 200); seen.push(...fixtureIds(page.body)); cursor = page.body.nextCursor;
    assert.ok(seen.length <= expected.length);
  }
  assert.deepEqual(seen, expected); assert.equal(new Set(seen).size, 6); assert.ok(!seen.includes(newer.id));
});

test("cursor kullanıcı/kategori/sekme/kaynak bağlamına bağlı; filtre değişince 400", async () => {
  await befriend(); await poll(); await poll();
  const first = await feed("&scope=friends&limit=1"); const cursor = first.body.nextCursor;
  assert.ok(cursor);
  for (const [query, actor] of [[`scope=everyone&category=TATTOO`, actors[1]], [`scope=friends&category=SHOES`, actors[1]], [`scope=friends&category=TATTOO`, actors[2]]] as const) {
    const response = await call("GET", `/feed?${query}&cursor=${cursor}`, actor);
    assert.equal(response.status, 400); assert.equal(response.body.error.code, "INVALID_CURSOR");
  }
  const mine = await call("GET", "/me/polls?limit=1", actors[0]); assert.ok(mine.body.nextCursor);
  assert.equal((await feed(`&cursor=${mine.body.nextCursor}`, actors[0])).body.error.code, "INVALID_CURSOR");
});

test("sayfalar arasında arkadaşlık kaldırma özel yayınları kapatır; PUBLIC herkes sekmesinde kalır", async () => {
  await befriend(); const privatePoll = await poll(actors[0], { visibility: "FRIENDS" }); const publicPoll = await poll();
  const first = await feed("&scope=friends&limit=1"); assert.ok(first.body.nextCursor);
  assert.equal((await call("DELETE", `/friends/${actors[0].id}`)).status, 200);
  assert.deepEqual((await feed(`&scope=friends&limit=1&cursor=${first.body.nextCursor}`)).body.items, []);
  assert.deepEqual(fixtureIds((await feed()).body), [publicPoll.id]);
  assert.equal((await call("GET", `/polls/${privatePoll.id}`)).status, 404);
  assert.equal((await call("GET", `/media/${privatePoll.options[0].mediaId}/content`)).status, 404);
});

test("iki yönlü engel tüm sekmelerden kaldırır; unblock PUBLIC'i geri açar", async () => {
  const row = await poll();
  for (const [blocker, target] of [[actors[0], actors[1]], [actors[1], actors[0]]]) {
    assert.equal((await call("PUT", `/blocks/${target.id}`, blocker)).status, 200);
    assert.deepEqual(fixtureIds((await feed()).body), []); assert.deepEqual((await feed("&scope=friends")).body.items, []);
    assert.equal((await call("GET", `/polls/${row.id}`)).status, 404);
    assert.equal((await call("DELETE", `/blocks/${target.id}`, blocker)).status, 200);
    assert.deepEqual(fixtureIds((await feed()).body), [row.id]);
  }
});

test("kart detayla aynı sözleşmeyi ve yetkili medya yollarını taşır; sonuç/özel veri sızdırmaz", async () => {
  const row = await poll();
  await call("PUT", `/polls/${row.id}/vote`, actors[2], { optionId: row.options[0].id });
  await db.pollSave.create({ data: { userId: actors[1].id, pollId: row.id } });
  const response = await feed(); const card = response.body.items.find((item: any) => item.id === row.id);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(card.canVote, true); assert.equal(card.canViewResults, false); assert.equal(card.myOptionId, null);
  assert.equal(card.totalVotes, 1); assert.equal(card.isSaved, true); assert.equal(card.commentCount, 0);
  assert.equal(card.likeCount, 0); assert.equal(card.isLiked, false);
  assert.equal(card.serverNow, response.body.serverNow); assert.ok(card.remainingSeconds > 0 && card.remainingSeconds <= 1800);
  const detail = (await call("GET", `/polls/${row.id}`)).body;
  const { totalVotes, commentCount, isSaved, likeCount, isLiked, coverOptionId, ...common } = card;
  const { serverNow: _serverNow, remainingSeconds: _remainingSeconds, ...stableDetail } = detail;
  const { serverNow: _cardNow, remainingSeconds: _cardRemaining, ...stableCard } = common;
  assert.deepEqual(stableCard, stableDetail);
  assert.equal(card.options.length, 2); assert.deepEqual(card.options.map((item: any) => item.label), ["A", "B"]);
  assert.equal(card.options[0].media.displayPath, `/v1/media/${row.options[0].mediaId}/content`);
  assert.equal(card.options[0].products[0].externalUrl, "https://example.com/item?ref=original");
  assert.equal(card.options[0].products[0].source, "USER_ENTERED");
  const json = JSON.stringify(card);
  for (const key of ["email", "privateData", "genderAtVote", "voterId", "displayKey", "uploadKey", "percentage", "winningOptionIds"]) assert.ok(!json.includes(`"${key}"`), key);
  assert.equal((await call("GET", `/polls/${row.id}/results`)).status, 403);
  const before = await db.outboxEvent.count({ where: { aggregateId: { in: polls } } });
  await feed(); await feed();
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: { in: polls } } }), before);
});

test("yorum sayacı gizli/kaldırılmış/pasif/engellenmiş yazarları saymaz", async () => {
  const row = await poll();
  for (const authorId of actors.map((actor) => actor.id)) await db.comment.create({ data: { pollId: row.id, authorId, body: "Güzel" } });
  for (const contentStatus of ["HIDDEN", "REMOVED"] as const) await db.comment.create({ data: { pollId: row.id, authorId: actors[0].id, body: "Gizli", contentStatus } });
  await db.user.update({ where: { id: actors[2].id }, data: { status: "SUSPENDED" } });
  await call("PUT", `/blocks/${actors[3].id}`, actors[1]);
  assert.equal((await feed()).body.items.find((item: any) => item.id === row.id).commentCount, 2);
});

test("sayfalar arasında süre dolarsa kapanış işçisini beklemeden kart çıkar", async () => {
  await befriend(); const rows = [await poll(), await poll()];
  const first = await feed("&scope=friends&limit=1"); assert.ok(first.body.nextCursor);
  const next = rows.find((row) => row.id !== first.body.items[0].id)!;
  await db.poll.update({ where: { id: next.id }, data: { closesAt: new Date(Date.now() - 1000) } });
  const page = await feed(`&scope=friends&limit=1&cursor=${first.body.nextCursor}`);
  assert.deepEqual(page.body.items, []); assert.equal(page.body.nextCursor, null);
});

test("OpenAPI filtreleri ve kart/yanıt alanlarını belgeler", async () => {
  const schema = (await call("GET", "/openapi.json", null)).body;
  const operation = schema.paths["/v1/feed"].get;
  assert.ok(operation.security.some((item: any) => "bearer" in item));
  assert.deepEqual(operation.parameters.map((item: any) => item.name).sort(), ["category", "cursor", "limit", "scope"]);
  for (const field of ["items", "serverNow", "nextCursor"]) assert.ok(schema.components.schemas.FeedResponseDto.properties[field]);
  for (const field of ["options", "author", "canVote", "canViewResults", "remainingSeconds", "totalVotes", "commentCount", "isSaved"]) assert.ok(schema.components.schemas.FeedItemDto.properties[field]);
});
