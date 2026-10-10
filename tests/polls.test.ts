import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import sharp from "sharp";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const { createApp } = await import(new URL("../dist/create-app.js", import.meta.url).href) as { createApp: () => Promise<NestExpressApplication> };
const { PrismaService } = await import(new URL("../dist/database/prisma.service.js", import.meta.url).href);
type Account = { id: string; token: string };
let app: NestExpressApplication;
let db: PrismaClient;
let base: string;
let accounts: Account[];
let directory: string;
let pollIds: Set<string>;
const envBefore = { NODE_ENV: process.env.NODE_ENV, AUTH_MOCK_ENABLED: process.env.AUTH_MOCK_ENABLED, LOCAL_MEDIA_DIR: process.env.LOCAL_MEDIA_DIR };
const png = await sharp({ create: { width: 48, height: 64, channels: 3, background: "#70a090" } }).png().toBuffer();

async function call(method: string, path: string, actor: Account | null = accounts[0], body?: unknown, key: string | null = randomUUID()) {
  const response = await fetch(`${base}${path}`, { method,
    headers: { ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(key ? { "Idempotency-Key": key } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20_000),
  });
  const result = { status: response.status, body: await response.json() as any };
  if (method === "POST" && path === "/polls" && result.status === 201) pollIds.add(result.body.id);
  return result;
}

async function media(actor = accounts[0], options: { purpose?: string; approve?: boolean } = {}) {
  const g = await call("POST", "/media/uploads", actor, { purpose: options.purpose ?? "POLL", mimeType: "image/png", byteSize: png.length, blurRequested: false });
  assert.equal(g.status, 201);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "outfit.png");
  const uploaded = await fetch(`${base.replace(/\/v1$/, "")}${g.body.upload.path}`, { method: "POST", headers: { Authorization: `Bearer ${actor.token}`, "X-Upload-Token": g.body.upload.token }, body: form, signal: AbortSignal.timeout(10_000) });
  assert.equal(uploaded.status, 200);
  const id = g.body.asset.id as string;
  assert.equal((await call("POST", `/media/${id}/complete`, actor, {})).status, 200);
  if (options.approve !== false) assert.equal((await call("POST", `/media/${id}/accept-preview`, actor, { confirmed: true })).status, 200);
  return id;
}

async function draft(body: Record<string, unknown> = {}) {
  const result = await call("POST", "/polls", accounts[0], { question: "Hangisini giyeyim?", ...body });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body;
}

async function withPhotos(body: Record<string, unknown> = {}) {
  const first = await media();
  const second = await media();
  return draft({ options: [{ position: 1, mediaId: first }, { position: 2, mediaId: second }], ...body });
}

async function publish(poll: any, key = randomUUID()) {
  const result = await call("POST", `/polls/${poll.id}/publish`, accounts[0], { expectedVersion: poll.version }, key);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

async function imageStatus(mediaId: string, actor: Account) {
  const response = await fetch(`${base}/media/${mediaId}/content`, { headers: { Authorization: `Bearer ${actor.token}` }, signal: AbortSignal.timeout(10_000) });
  await response.arrayBuffer();
  return response.status;
}

beforeEach(async () => {
  process.env.NODE_ENV = "test";
  process.env.AUTH_MOCK_ENABLED = "true";
  directory = await mkdtemp(join(tmpdir(), "podyum-polls-"));
  process.env.LOCAL_MEDIA_DIR = directory;
  accounts = [];
  pollIds = new Set();
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = `${await app.getUrl()}/v1`;
  db = app.get(PrismaService);
  for (let i = 0; i < 3; i++) {
    const session = await call("POST", "/auth/mock", null, { provider: "google", subject: `poll_${randomUUID()}`, acknowledgeMock: true });
    assert.equal(session.status, 200);
    const actor = { id: "", token: session.body.accessToken };
    actor.id = (await call("GET", "/auth/me", actor)).body.user.id;
    accounts.push(actor);
  }
});

afterEach(async () => {
  try {
    if (db) {
      const ids = accounts.map(({ id }) => id);
      for (const poll of await db.poll.findMany({ where: { authorId: { in: ids } }, select: { id: true } })) pollIds.add(poll.id);
      await db.$transaction(async (tx) => {
        await tx.outboxEvent.deleteMany({ where: { aggregateId: { in: [...ids, ...pollIds] } } });
        await tx.idempotencyRecord.deleteMany({ where: { userId: { in: ids } } });
        await tx.productTag.deleteMany({ where: { option: { poll: { authorId: { in: ids } } } } });
        await tx.pollOption.deleteMany({ where: { poll: { authorId: { in: ids } } } });
        await tx.poll.deleteMany({ where: { authorId: { in: ids } } });
        await tx.mediaAsset.deleteMany({ where: { ownerId: { in: ids } } });
        await tx.block.deleteMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } });
        await tx.friendship.deleteMany({ where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } });
        await tx.outboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
        await tx.userSettings.deleteMany({ where: { userId: { in: ids } } });
        await tx.usedRefreshToken.deleteMany({ where: { session: { userId: { in: ids } } } });
        await tx.authSession.deleteMany({ where: { userId: { in: ids } } });
        await tx.authIdentity.deleteMany({ where: { userId: { in: ids } } });
        await tx.user.deleteMany({ where: { id: { in: ids } } });
      });
    }
  } finally {
    await app?.close();
    await rm(directory, { recursive: true, force: true });
    for (const key of Object.keys(envBefore) as (keyof typeof envBefore)[]) {
      if (envBefore[key] === undefined) delete process.env[key]; else process.env[key] = envBefore[key];
    }
  }
});

test("oylama uçları oturum, işlem anahtarı, UUID ve katı body/query doğrulaması ister", async () => {
  const id = randomUUID();
  for (const [method, path] of [["POST", "/polls"], ["PATCH", `/polls/${id}`], ["POST", `/polls/${id}/publish`], ["POST", `/polls/${id}/cancel`], ["DELETE", `/polls/${id}?expectedVersion=0`], ["PATCH", `/polls/${id}/comment-settings`], ["GET", `/polls/${id}`], ["GET", "/me/polls"]]) {
    assert.equal((await call(method, path, null)).status, 401);
  }
  assert.equal((await call("POST", "/polls", accounts[0], {}, null)).body.error.code, "IDEMPOTENCY_KEY_REQUIRED");
  assert.equal((await call("POST", "/polls", accounts[0], {}, "short")).body.error.code, "INVALID_IDEMPOTENCY_KEY");
  for (const body of [{ authorId: accounts[1].id }, { question: null }, { durationSeconds: "1800" }, { durationSeconds: 60 }, { options: null }, { options: [null] }, { audienceGender: "WOMEN" }, { question: "x".repeat(281) }, { visibility: "PRIVATE" }]) {
    assert.equal((await call("POST", "/polls", accounts[0], body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await call("GET", "/polls/no-uuid")).status, 400);
  for (const path of ["/me/polls?status=INVALID", "/me/polls?limit=51", "/me/polls?userId=other", `/polls/${id}?expectedVersion=-1`]) {
    if (path.startsWith("/me")) assert.equal((await call("GET", path)).status, 400);
    else assert.equal((await call("DELETE", path)).status, 400);
  }
  assert.equal(await db.poll.count({ where: { authorId: accounts[0].id } }), 0);
});

test("boş taslak profil varsayılanlarını alır; başlangıç zamanı yoktur ve yalnız sahibine açıktır", async () => {
  await call("PATCH", "/me/settings", accounts[0], { defaultPollVisibility: "FRIENDS", defaultCommentsEnabled: false });
  const result = await call("POST", "/polls", accounts[0], {});
  assert.equal(result.status, 201, JSON.stringify(result.body));
  const poll = result.body;
  assert.equal(poll.status, "DRAFT");
  assert.equal(poll.question, "");
  assert.equal(poll.category, "OUTFIT");
  assert.equal(poll.visibility, "FRIENDS");
  assert.equal(poll.commentsEnabled, false);
  assert.equal(poll.publishedAt, null);
  assert.equal(poll.closesAt, null);
  assert.equal(poll.version, 0);
  assert.deepEqual(poll.options, []);
  assert.equal(poll.author.id, accounts[0].id);
  assert.equal((await call("GET", `/polls/${poll.id}`, accounts[1])).status, 404);
  assert.equal((await call("GET", "/me")).body.profile.counts.polls, 0);
  assert.equal((await call("GET", "/me/polls?status=DRAFT")).body.items[0].id, poll.id);
  const explicit = await draft({ visibility: "PUBLIC", commentsEnabled: true });
  assert.equal(explicit.visibility, "PUBLIC");
  assert.equal(explicit.commentsEnabled, true);
});

test("create tekrarları kalıcıdır, canonical body sırası değişebilir ve anahtar kullanıcıya bağlıdır", async () => {
  const key = randomUUID();
  const original = await call("POST", "/polls", accounts[0], { question: "  Bir soru  ", category: "SHOES" }, key);
  assert.equal(original.status, 201);
  const repeated = await call("POST", "/polls", accounts[0], { category: "SHOES", question: "Bir soru" }, key);
  assert.deepEqual(repeated.body, original.body);
  const duplicate = await call("POST", "/polls", accounts[0], { question: "Başka soru", category: "SHOES" }, key);
  assert.equal(duplicate.body.error.code, "IDEMPOTENCY_KEY_REUSED");
  assert.equal(await db.poll.count({ where: { authorId: accounts[0].id } }), 1);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: original.body.id } }), 1);
  assert.equal((await call("POST", "/polls", accounts[1], { question: "Bir soru", category: "SHOES" }, key)).status, 201);
  const record = await db.idempotencyRecord.findUniqueOrThrow({ where: { userId_scope_key: { userId: accounts[0].id, scope: "polls.create", key } } });
  assert.equal(record.responseCode, 201);
  assert.equal(record.requestHash.length, 64);
  assert.equal(record.responseBody !== null, true);
});

test("kalıcı tekrar API yeniden başladıktan sonra da aynı yanıtı verir; süresi dolan anahtar yeniden kullanılabilir", async () => {
  const key = randomUUID();
  const first = await call("POST", "/polls", accounts[0], {}, key);
  await app.close();
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = `${await app.getUrl()}/v1`;
  db = app.get(PrismaService);
  assert.deepEqual((await call("POST", "/polls", accounts[0], {}, key)).body, first.body);
  await db.idempotencyRecord.update({ where: { userId_scope_key: { userId: accounts[0].id, scope: "polls.create", key } }, data: { expiresAt: new Date(0) } });
  const afterExpiry = await call("POST", "/polls", accounts[0], {}, key);
  assert.equal(afterExpiry.status, 201);
  assert.notEqual(afterExpiry.body.id, first.body.id);
});

test("güncelleme sürümlüdür; seçenek değişimi/ürünler atomiktir ve istemci kimliği yönetime yazamaz", async () => {
  const poll = await withPhotos();
  const oldOptions = poll.options.map((option: any) => option.id);
  const originalUrl = "https://www.zara.com/tr/tr/item.html?affiliate_id=abc&utm_source=creator#detail";
  const body = { expectedVersion: 0, question: "  Buluşmada hangisi?  ", occasion: "FIRST_DATE", durationSeconds: 7200, options: [
    { position: 1, mediaId: poll.options[1].mediaId, products: [{ title: "  Saten gömlek  ", brand: " Marka ", priceMinor: 129900, currency: "try", externalUrl: originalUrl }] },
    { position: 2, mediaId: poll.options[0].mediaId },
  ] };
  const key = randomUUID();
  const changed = await call("PATCH", `/polls/${poll.id}`, accounts[0], body, key);
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal(changed.body.version, 1);
  assert.equal(changed.body.question, "Buluşmada hangisi?");
  assert.equal(changed.body.options[0].mediaId, poll.options[1].mediaId);
  assert.equal(changed.body.options[0].products[0].externalUrl, originalUrl);
  assert.equal(changed.body.options[0].products[0].title, "Saten gömlek");
  assert.equal(changed.body.options[0].products[0].currency, "TRY");
  assert.equal(changed.body.options[0].products[0].source, "USER_ENTERED");
  assert.ok(changed.body.options[0].products[0].priceRecordedAt);
  assert.equal(await db.pollOption.count({ where: { id: { in: oldOptions } } }), 0);
  assert.deepEqual((await call("PATCH", `/polls/${poll.id}`, accounts[0], body, key)).body, changed.body);
  assert.equal((await call("PATCH", `/polls/${poll.id}`, accounts[0], { expectedVersion: 0, question: "Eski istemci" })).body.error.code, "VERSION_CONFLICT");
  assert.equal((await call("PATCH", `/polls/${poll.id}`, accounts[0], { expectedVersion: 1 })).body.error.code, "EMPTY_UPDATE");
  assert.equal((await call("PATCH", `/polls/${poll.id}`, accounts[1], { expectedVersion: 1, question: "Sahip değil" })).status, 404);
  assert.equal((await call("PATCH", `/polls/${poll.id}`, accounts[0], { expectedVersion: 1, status: "OPEN" })).status, 400);
  assert.equal((await call("PATCH", `/polls/${poll.id}`, accounts[0], { expectedVersion: 1, occasion: null, options: [] })).body.options.length, 0);
});

test("aynı fotoğraf/position, aşırı seçenek/ürün, bozuk link/fiyat ve sahte katalog kimliği reddedilir", async () => {
  const mediaId = await media();
  const option = { position: 1, mediaId };
  for (const options of [[option, option], [option, { position: 2, mediaId }], Array.from({ length: 5 }, (_, i) => ({ position: i + 1, mediaId: randomUUID() }))]) {
    assert.equal((await call("POST", "/polls", accounts[0], { options })).status, 400);
  }
  for (const product of [
    { title: "Gömlek", externalUrl: "javascript:alert(1)" }, { title: "Gömlek", externalUrl: "ftp://example.com/item" },
    { title: "Gömlek", externalUrl: "https://user:password@example.com/item" }, { title: "Gömlek", externalUrl: "https://example.com/item", priceMinor: -1 },
    { title: "Gömlek", externalUrl: "https://example.com/item", priceMinor: 2_147_483_648 }, { title: "Gömlek", externalUrl: "https://example.com/item", productId: randomUUID() },
    { title: "Gömlek", externalUrl: "https://example.com/item", currency: null },
  ]) assert.equal((await call("POST", "/polls", accounts[0], { options: [{ ...option, products: [product] }] })).status, 400, JSON.stringify(product));
  assert.equal((await call("POST", "/polls", accounts[0], { options: [{ ...option, products: Array.from({ length: 11 }, () => ({ title: "Ürün", externalUrl: "https://example.com/item" })) }] })).status, 400);
});

test("taslak kendi işlenen/onaysız fotoğrafına bağlanabilir; başka sahip, avatar veya silinmiş medya kullanılamaz", async () => {
  const pending = await call("POST", "/media/uploads", accounts[0], { purpose: "POLL", mimeType: "image/png", byteSize: png.length, blurRequested: false });
  const incomplete = await draft({ options: [{ position: 1, mediaId: pending.body.asset.id }, { position: 2, mediaId: await media() }] });
  assert.equal((await call("POST", `/polls/${incomplete.id}/publish`, accounts[0], { expectedVersion: 0 })).body.error.code, "MEDIA_NOT_APPROVED");
  const unapproved = await media(accounts[0], { approve: false });
  const ready = await media();
  const poll = await draft({ options: [{ position: 1, mediaId: unapproved }, { position: 2, mediaId: ready }] });
  const key = randomUUID();
  assert.equal((await call("POST", `/polls/${poll.id}/publish`, accounts[0], { expectedVersion: 0 }, key)).body.error.code, "MEDIA_NOT_APPROVED");
  assert.equal(await db.idempotencyRecord.count({ where: { scope: `polls.publish:${poll.id}` } }), 0);
  assert.equal((await call("GET", `/polls/${poll.id}`)).body.status, "DRAFT");
  await call("POST", `/media/${unapproved}/accept-preview`, accounts[0], { confirmed: true });
  assert.equal((await call("POST", `/polls/${poll.id}/publish`, accounts[0], { expectedVersion: 0 }, key)).status, 200);
  const foreign = await media(accounts[1]);
  const avatar = await media(accounts[0], { purpose: "AVATAR" });
  const deleted = await media();
  await call("DELETE", `/media/${deleted}`);
  for (const [mediaId, status] of [[foreign, 404], [avatar, 409], [deleted, 404]] as const) {
    assert.equal((await call("POST", "/polls", accounts[0], { options: [{ position: 1, mediaId }] })).status, status);
  }
  assert.equal(await db.poll.count({ where: { authorId: accounts[0].id } }), 2);
});

test("yayın soru/2–4 ardışık seçenek/onay gerektirir; 4 seçenek ve üç süre desteklenir", async () => {
  const empty = await draft({ question: "" });
  assert.equal((await call("POST", `/polls/${empty.id}/publish`, accounts[0], { expectedVersion: 0 })).body.error.code, "QUESTION_REQUIRED");
  const noOptions = await draft();
  assert.equal((await call("POST", `/polls/${noOptions.id}/publish`, accounts[0], { expectedVersion: 0 })).body.error.code, "INVALID_OPTION_COUNT");
  const ids = [await media(), await media(), await media(), await media()];
  const gap = await draft({ options: [{ position: 1, mediaId: ids[0] }, { position: 3, mediaId: ids[1] }] });
  assert.equal((await call("POST", `/polls/${gap.id}/publish`, accounts[0], { expectedVersion: 0 })).body.error.code, "INVALID_OPTION_ORDER");
  for (const durationSeconds of [1800, 7200, 86400]) {
    const poll = await draft({ durationSeconds, options: ids.map((mediaId, index) => ({ position: index + 1, mediaId })) });
    const open = await publish(poll);
    assert.equal(open.status, "OPEN");
    assert.equal(open.version, 1);
    assert.equal(open.options.length, 4);
    assert.equal(Date.parse(open.closesAt) - Date.parse(open.publishedAt), durationSeconds * 1000);
    assert.equal(open.serverNow, open.publishedAt);
    assert.equal(open.remainingSeconds, durationSeconds);
  }
});

test("yayın tekrarında süre/sürüm/olay değişmez; yayın sonrası içerik sabittir, yorum izni ayrı değişir", async () => {
  const poll = await withPhotos();
  const key = randomUUID();
  const open = await publish(poll, key);
  assert.deepEqual((await call("POST", `/polls/${poll.id}/publish`, accounts[0], { expectedVersion: 0 }, key)).body, open);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: poll.id, type: "poll.published" } }), 1);
  assert.equal((await call("PATCH", `/polls/${poll.id}`, accounts[0], { expectedVersion: 1, question: "Sonradan değiştir" })).body.error.code, "POLL_NOT_DRAFT");
  assert.equal((await call("DELETE", `/polls/${poll.id}?expectedVersion=1`)).body.error.code, "POLL_NOT_DRAFT");
  assert.equal((await call("POST", `/polls/${poll.id}/publish`, accounts[0], { expectedVersion: 1 })).body.error.code, "POLL_NOT_DRAFT");
  const changed = await call("PATCH", `/polls/${poll.id}/comment-settings`, accounts[0], { expectedVersion: 1, commentsEnabled: false });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.version, 2);
  assert.equal(changed.body.commentsEnabled, false);
  assert.deepEqual(changed.body.options, open.options);
  assert.equal(changed.body.closesAt, open.closesAt);
  assert.equal((await call("PATCH", `/polls/${poll.id}/comment-settings`, accounts[0], { expectedVersion: 2, commentsEnabled: false })).body.version, 2);
});

test("FRIENDS yayın ve görseller aynı erişimi uygular; arkadaşlık/engel kaldırma sonraki okumayı değiştirir", async () => {
  const poll = await withPhotos({ visibility: "FRIENDS" });
  const open = await publish(poll);
  assert.equal((await call("GET", `/polls/${poll.id}`, accounts[1])).status, 404);
  assert.equal(await imageStatus(open.options[0].mediaId, accounts[1]), 404);
  await call("POST", "/friend-requests", accounts[0], { targetUserId: accounts[1].id });
  await call("POST", `/friend-requests/${accounts[0].id}/accept`, accounts[1]);
  assert.equal((await call("GET", `/polls/${poll.id}`, accounts[1])).status, 200);
  assert.equal(await imageStatus(open.options[0].mediaId, accounts[1]), 200);
  assert.equal((await call("GET", `/polls/${poll.id}`, accounts[2])).status, 404);
  assert.equal((await call("GET", "/me")).body.profile.counts.polls, 1);
  await call("DELETE", `/friends/${accounts[0].id}`, accounts[1]);
  assert.equal((await call("GET", `/polls/${poll.id}`, accounts[1])).status, 404);
  const publicPoll = await publish(await withPhotos());
  assert.equal((await call("GET", `/polls/${publicPoll.id}`, accounts[2])).status, 200);
  await call("PUT", `/blocks/${accounts[0].id}`, accounts[2]);
  assert.equal((await call("GET", `/polls/${publicPoll.id}`, accounts[2])).status, 404);
  assert.equal(await imageStatus(publicPoll.options[0].mediaId, accounts[2]), 404);
});

test("iptal atomiktir; yazar görür, başkasının detay/fotoğraf erişimi kapanır; süresi dolan iptal edilemez", async () => {
  const open = await publish(await withPhotos());
  const key = randomUUID();
  const cancelled = await call("POST", `/polls/${open.id}/cancel`, accounts[0], { expectedVersion: 1 }, key);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.status, "CANCELLED");
  assert.equal(cancelled.body.version, 2);
  assert.equal(cancelled.body.canCancel, false);
  assert.deepEqual((await call("POST", `/polls/${open.id}/cancel`, accounts[0], { expectedVersion: 1 }, key)).body, cancelled.body);
  assert.equal((await call("GET", `/polls/${open.id}`, accounts[1])).status, 404);
  assert.equal(await imageStatus(open.options[0].mediaId, accounts[1]), 404);
  assert.equal((await call("POST", `/polls/${open.id}/cancel`, accounts[1], { expectedVersion: 2 })).status, 404);
  const expired = await publish(await withPhotos());
  await db.poll.update({ where: { id: expired.id }, data: { publishedAt: new Date(Date.now() - 3_600_000), closesAt: new Date(Date.now() - 1000) } });
  const detail = await call("GET", `/polls/${expired.id}`);
  assert.equal(detail.body.status, "OPEN");
  assert.equal(detail.body.effectiveStatus, "CLOSED");
  assert.equal(detail.body.remainingSeconds, 0);
  assert.equal((await call("POST", `/polls/${expired.id}/cancel`, accounts[0], { expectedVersion: 1 })).body.error.code, "POLL_EXPIRED");
  assert.equal((await call("GET", "/me/polls?status=OPEN")).body.items.length, 0);
  assert.equal((await call("GET", "/me/polls?status=CLOSED")).body.items[0].id, expired.id);
});

test("taslak silme etiket/seçenek bağlarını kaldırır; medya korunur, tekrar silme aynı anahtarla güvenlidir", async () => {
  const first = await media();
  const poll = await draft({ options: [{ position: 1, mediaId: first, products: [{ title: "Gömlek", externalUrl: "https://example.com/item", priceMinor: 0 }] }] });
  const key = randomUUID();
  assert.equal((await call("DELETE", `/polls/${poll.id}?expectedVersion=0`, accounts[1], undefined, key)).status, 404);
  const result = await call("DELETE", `/polls/${poll.id}?expectedVersion=0`, accounts[0], undefined, key);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.deepEqual(result.body, { id: poll.id, deleted: true });
  assert.deepEqual((await call("DELETE", `/polls/${poll.id}?expectedVersion=0`, accounts[0], undefined, key)).body, result.body);
  assert.equal((await call("GET", `/polls/${poll.id}`)).status, 404);
  assert.equal(await db.pollOption.count({ where: { pollId: poll.id } }), 0);
  assert.equal(await db.productTag.count({ where: { optionId: poll.options[0].id } }), 0);
  assert.equal((await call("GET", `/media/${first}`)).body.status, "READY");
  assert.equal((await call("DELETE", `/media/${first}`)).status, 200);
});

test("kendi liste cursor'ı eşit tarihlerde boşluk/tekrar üretmez; kullanıcı ve status'a bağlıdır", async () => {
  const polls = [await draft(), await draft(), await draft()];
  await db.poll.updateMany({ where: { id: { in: polls.map((p) => p.id) } }, data: { createdAt: new Date("2026-10-10T00:00:00Z") } });
  const first = await call("GET", "/me/polls?limit=1&status=DRAFT");
  assert.equal(first.body.items.length, 1);
  assert.ok(first.body.nextCursor);
  const seen = [first.body.items[0].id];
  let cursor = first.body.nextCursor;
  while (cursor) {
    const page = await call("GET", `/me/polls?limit=1&status=DRAFT&cursor=${cursor}`);
    assert.equal(page.status, 200);
    seen.push(...page.body.items.map((p: any) => p.id));
    cursor = page.body.nextCursor;
    assert.ok(seen.length <= 3);
  }
  assert.deepEqual(seen, polls.map((p) => p.id).sort().reverse());
  assert.equal((await call("GET", `/me/polls?cursor=${first.body.nextCursor}`, accounts[1])).body.error.code, "INVALID_CURSOR");
  assert.equal((await call("GET", `/me/polls?status=OPEN&cursor=${first.body.nextCursor}`)).body.error.code, "INVALID_CURSOR");
});

test("aynı create anahtarıyla eşzamanlı HTTP istekleri tek kayda iner; eski sürümlü düzenlemeler çakışır", async () => {
  const key = randomUUID();
  const [a, b] = await Promise.all([call("POST", "/polls", accounts[0], { question: "A mı B mi?" }, key), call("POST", "/polls", accounts[0], { question: "A mı B mi?" }, key)]);
  assert.equal(a.status, 201);
  assert.deepEqual(a.body, b.body);
  const changes = await Promise.all([call("PATCH", `/polls/${a.body.id}`, accounts[0], { expectedVersion: 0, question: "Birinci" }), call("PATCH", `/polls/${a.body.id}`, accounts[0], { expectedVersion: 0, question: "İkinci" })]);
  assert.deepEqual(changes.map((result) => result.status).sort(), [200, 409]);
  assert.equal(await db.poll.count({ where: { authorId: accounts[0].id } }), 1);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: a.body.id } }), 2);
});

test("outbox veya idempotency yazımı hata verirse yayın/düzenleme ve seçenekler geri alınır", async () => {
  const poll = await withPhotos();
  const eventCreate = db.outboxEvent.create.bind(db.outboxEvent);
  const recordCreate = db.idempotencyRecord.create.bind(db.idempotencyRecord);
  // Prisma transaction delegate'lerini etkilemek için extension yerine servis içindeki
  // transaction callback'i aynı tx üzerinde arıza enjekte ederek sarmalanır.
  const transaction = db.$transaction.bind(db) as any;
  let failure: "outbox" | "record" = "outbox";
  (db as any).$transaction = (work: any, options: any) => transaction(async (tx: any) => {
    if (failure === "outbox") tx.outboxEvent.create = async () => { throw new Error("test outbox failure"); };
    else tx.idempotencyRecord.create = async () => { throw new Error("test record failure"); };
    return work(tx);
  }, options);
  try {
    const key = randomUUID();
    assert.equal((await call("POST", `/polls/${poll.id}/publish`, accounts[0], { expectedVersion: 0 }, key)).status, 500);
    failure = "record";
    assert.equal((await call("PATCH", `/polls/${poll.id}`, accounts[0], { expectedVersion: 0, question: "Kaybolmalı", options: [] })).status, 500);
  } finally {
    (db as any).$transaction = transaction;
    db.outboxEvent.create = eventCreate as typeof db.outboxEvent.create;
    db.idempotencyRecord.create = recordCreate as typeof db.idempotencyRecord.create;
  }
  const unchanged = (await call("GET", `/polls/${poll.id}`)).body;
  assert.equal(unchanged.version, 0);
  assert.equal(unchanged.status, "DRAFT");
  assert.deepEqual(unchanged.options, poll.options);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: poll.id } }), 1);
  assert.equal(await db.idempotencyRecord.count({ where: { scope: { in: [`polls.publish:${poll.id}`, `polls.update:${poll.id}`] } } }), 0);
});

test("gizlenen/kaldırılan yayın ve inaktif yazar başkasına kapalıdır; gelişmiş kitle varsayımla açılmaz", async () => {
  const poll = await withPhotos();
  await db.poll.update({ where: { id: poll.id }, data: { audienceGender: "WOMEN" } });
  assert.equal((await call("POST", `/polls/${poll.id}/publish`, accounts[0], { expectedVersion: 0 })).body.error.code, "UNSUPPORTED_AUDIENCE");
  await db.poll.update({ where: { id: poll.id }, data: { audienceGender: "ANY" } });
  const open = await publish(poll);
  for (const contentStatus of ["HIDDEN", "REMOVED"] as const) {
    await db.poll.update({ where: { id: poll.id }, data: { contentStatus } });
    assert.equal((await call("GET", `/polls/${poll.id}`, accounts[1])).status, 404);
    assert.equal(await imageStatus(open.options[0].mediaId, accounts[1]), 404);
    assert.equal((await call("GET", `/polls/${poll.id}`)).body.contentStatus, contentStatus);
  }
  await db.poll.update({ where: { id: poll.id }, data: { contentStatus: "VISIBLE" } });
  await db.user.update({ where: { id: accounts[0].id }, data: { status: "SUSPENDED" } });
  assert.equal((await call("GET", `/polls/${poll.id}`, accounts[1])).status, 404);
});

test("oluşturma kotası taslak ve son 24 saatlik başarılı işlemleri sayar; başarısız işlem anahtarı tüketmez", async () => {
  await db.poll.createMany({ data: Array.from({ length: 50 }, () => ({ authorId: accounts[0].id, question: "Kota taslağı", category: "OUTFIT" as const })) });
  const key = randomUUID();
  assert.equal((await call("POST", "/polls", accounts[0], {}, key)).body.error.code, "POLL_QUOTA_EXCEEDED");
  assert.equal(await db.idempotencyRecord.count({ where: { userId: accounts[0].id } }), 0);
  await db.poll.deleteMany({ where: { authorId: accounts[0].id } });
  const keys = Array.from({ length: 100 }, () => randomUUID());
  await db.idempotencyRecord.createMany({ data: keys.map((storedKey) => ({ userId: accounts[0].id, scope: "polls.create", key: storedKey,
    requestHash: "0".repeat(64), responseCode: 201, responseBody: {}, expiresAt: new Date(Date.now() + 86_400_000) })) });
  assert.equal((await call("POST", "/polls", accounts[0], {}, key)).body.error.code, "POLL_QUOTA_EXCEEDED");
  await db.idempotencyRecord.update({ where: { userId_scope_key: { userId: accounts[0].id, scope: "polls.create", key: keys[0] } }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await call("POST", "/polls", accounts[0], {}, key)).status, 201);
  assert.equal(await db.poll.count({ where: { authorId: accounts[0].id } }), 1);
});

test("OpenAPI çalışan oylama yollarını, expectedVersion ve gerekli Idempotency-Key başlığını içerir", async () => {
  const schema = await call("GET", "/openapi.json", null);
  assert.equal(schema.status, 200);
  for (const [path, method] of [["/v1/polls", "post"], ["/v1/polls/{id}", "patch"], ["/v1/polls/{id}/publish", "post"], ["/v1/polls/{id}/cancel", "post"], ["/v1/polls/{id}", "delete"]]) {
    const operation = schema.body.paths[path][method];
    assert.ok(operation.security.some((security: any) => "bearer" in security));
    assert.ok(operation.parameters.some((parameter: any) => parameter.in === "header" && parameter.name === "Idempotency-Key" && parameter.required));
  }
  assert.ok(schema.body.components.schemas.UpdatePollDto.required.includes("expectedVersion"));
  assert.equal(schema.body.paths["/v1/polls/{id}/vote"], undefined);
  assert.equal(schema.body.paths["/v1/feed"], undefined);
});
