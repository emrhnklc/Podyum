import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const load = (path: string) => import(new URL(`../dist/${path}.js`, import.meta.url).href);
const { createApp } = await load("create-app") as { createApp: () => Promise<NestExpressApplication> };
const { PrismaService } = await load("database/prisma.service");
const { OutboxDispatcher } = await load("common/outbox/outbox-dispatcher");
const { PollParticipationService } = await load("modules/polls/poll-participation.service");
const { GameLifecycleService } = await load("modules/games/game-lifecycle.service");
type Actor = { id: string; token: string };
type Push = { to: string; title: string; body: string; ttlSeconds: number; data: Record<string, string> };
let app: NestExpressApplication; let db: PrismaClient; let base: string; let pushDir: string;
let actors: Actor[]; let polls: string[]; let sessions: string[]; let stub: Server | undefined;
const envKeys = ["NODE_ENV", "AUTH_MOCK_ENABLED", "LOCAL_PUSH_DIR", "PUSH_PROVIDER", "EXPO_PUSH_URL", "EXPO_ACCESS_TOKEN",
  "DAILY_GAME_START_TIME", "DAILY_GAME_TIME_ZONE", "DAILY_GAME_THEME_SLUG"] as const;
const originalEnv = Object.fromEntries(envKeys.map((name) => [name, process.env[name]]));

async function call(method: string, path: string, actor: Actor | null = actors[0], body?: unknown) {
  const response = await fetch(`${base}${path}`, { method, headers: {
    ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    "Idempotency-Key": randomUUID(),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
  return { status: response.status, body: await response.json() as any };
}

async function start() {
  app = await createApp(); await app.listen(0, "127.0.0.1"); base = `${await app.getUrl()}/v1`; db = app.get(PrismaService);
}
const drain = () => app.get(OutboxDispatcher).drain() as Promise<number>;
const list = async (actor: Actor) => (await call("GET", "/me/notifications", actor)).body;
const pushes = async () => Promise.all((await readdir(pushDir)).sort().map(async (name) => JSON.parse(await readFile(join(pushDir, name), "utf8")) as Push));

async function device(actor: Actor, token = `local-${randomUUID()}`, installationId = randomUUID()) {
  const result = await call("PUT", `/me/devices/${installationId}`, actor, { token, platform: "ios" });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return { token, installationId };
}

async function poll(author = actors[0], fields: { visibility?: "PUBLIC" | "FRIENDS"; contentStatus?: "VISIBLE" | "HIDDEN" } = {}) {
  const now = new Date();
  const row = await db.poll.create({ data: { authorId: author.id, question: "Hangisi daha iyi?", category: "OUTFIT", status: "OPEN",
    visibility: fields.visibility ?? "PUBLIC", contentStatus: fields.contentStatus ?? "VISIBLE",
    publishedAt: new Date(now.getTime() - 10000), closesAt: new Date(now.getTime() + 1800000),
    options: { create: [1, 2].map((position) => ({ position, media: { create: {
      ownerId: author.id, purpose: "POLL", status: "READY", uploadKey: `test-${randomUUID()}`, displayKey: `test-${randomUUID()}`, thumbnailKey: `test-${randomUUID()}`, previewAcceptedAt: now,
    } } })) },
  }, include: { options: { orderBy: { position: "asc" } } } });
  polls.push(row.id);
  return row;
}
type PollRow = Awaited<ReturnType<typeof poll>>;
const vote = async (row: PollRow, actor: Actor) => assert.equal((await call("PUT", `/polls/${row.id}/vote`, actor, { optionId: row.options[0].id })).status, 200);
async function comment(row: PollRow, actor: Actor, body = "Bence bu") {
  const result = await call("POST", `/polls/${row.id}/comments`, actor, { body });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.id as string;
}
async function close(row: PollRow) {
  await db.poll.update({ where: { id: row.id }, data: { closesAt: new Date(Date.now() - 1000) } });
  await app.get(PollParticipationService).closeExpiredBatch(100, row.id);
  assert.equal((await db.poll.findUniqueOrThrow({ where: { id: row.id } })).status, "CLOSED");
}
const request = async (from: Actor, to: Actor) => assert.equal((await call("POST", "/friend-requests", from, { targetUserId: to.id })).status, 200);

beforeEach(async () => {
  process.env.NODE_ENV = "test"; process.env.AUTH_MOCK_ENABLED = "true"; process.env.PUSH_PROVIDER = "local";
  delete process.env.EXPO_PUSH_URL; delete process.env.EXPO_ACCESS_TOKEN;
  delete process.env.DAILY_GAME_START_TIME; delete process.env.DAILY_GAME_TIME_ZONE; delete process.env.DAILY_GAME_THEME_SLUG;
  pushDir = await mkdtemp(join(tmpdir(), "podyum-push-")); process.env.LOCAL_PUSH_DIR = pushDir;
  actors = []; polls = []; sessions = []; stub = undefined;
  await start();
  for (let index = 0; index < 4; index++) {
    const session = await call("POST", "/auth/mock", null, { provider: "google", subject: `notifications_${randomUUID()}`, acknowledgeMock: true });
    assert.equal(session.status, 200);
    const actor = { id: "", token: session.body.accessToken };
    actor.id = (await call("GET", "/auth/me", actor)).body.user.id;
    actors.push(actor);
  }
  // Önceki çalışmalardan kalan olaylar bu testin sayımlarına karışmasın.
  await drain();
});

afterEach(async () => {
  try {
    const ids = actors.map((actor) => actor.id);
    await db.$transaction(async (tx) => {
      const comments = (await tx.comment.findMany({ where: { pollId: { in: polls } }, select: { id: true } })).map((row) => row.id);
      const reports = (await tx.report.findMany({ where: { reporterId: { in: ids } }, select: { id: true } })).map((row) => row.id);
      await tx.outboxEvent.deleteMany({ where: { OR: [{ aggregateId: { in: [...ids, ...polls, ...comments, ...reports, ...sessions] } },
        ...ids.map((userId) => ({ type: "notification.created", payload: { path: ["userId"], equals: userId } }))] } });
      await tx.idempotencyRecord.deleteMany({ where: { userId: { in: ids } } });
      await tx.notification.deleteMany({ where: { userId: { in: ids } } });
      await tx.deviceToken.deleteMany({ where: { userId: { in: ids } } });
      await tx.report.deleteMany({ where: { reporterId: { in: ids } } });
      await tx.gameLeaguePoint.deleteMany({ where: { sessionId: { in: sessions } } });
      await tx.gameOutcome.deleteMany({ where: { sessionId: { in: sessions } } });
      await tx.gameScore.deleteMany({ where: { sessionId: { in: sessions } } });
      await tx.gameSubmission.deleteMany({ where: { sessionId: { in: sessions } } });
      await tx.gameMembership.deleteMany({ where: { sessionId: { in: sessions } } });
      await tx.gameSession.deleteMany({ where: { id: { in: sessions } } });
      await tx.comment.deleteMany({ where: { pollId: { in: polls } } });
      await tx.pollVote.deleteMany({ where: { pollId: { in: polls } } });
      await tx.pollOption.deleteMany({ where: { pollId: { in: polls } } });
      await tx.poll.deleteMany({ where: { id: { in: polls } } });
      await tx.mediaAsset.deleteMany({ where: { ownerId: { in: ids } } });
      await tx.block.deleteMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } });
      await tx.friendship.deleteMany({ where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } });
      await tx.userSettings.deleteMany({ where: { userId: { in: ids } } });
      await tx.userPrivate.deleteMany({ where: { userId: { in: ids } } });
      await tx.usedRefreshToken.deleteMany({ where: { session: { userId: { in: ids } } } });
      await tx.authSession.deleteMany({ where: { userId: { in: ids } } });
      await tx.authIdentity.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    }, { timeout: 30000 });
  } finally {
    await app?.close();
    if (stub) await new Promise((resolve) => stub!.close(resolve));
    await rm(pushDir, { recursive: true, force: true });
    for (const name of envKeys) { if (originalEnv[name] === undefined) delete process.env[name]; else process.env[name] = originalEnv[name]; }
  }
});

test("bildirim ve cihaz uçları oturum, UUID ve katı DTO ister", async () => {
  for (const [method, path] of [["GET", "/me/notifications"], ["GET", "/me/notifications/unread-count"], ["POST", "/me/notifications/read-all"],
    ["PUT", `/me/notifications/${randomUUID()}/read`], ["PUT", `/me/devices/${randomUUID()}`], ["DELETE", `/me/devices/${randomUUID()}`]]) {
    assert.equal((await call(method, path, null, method === "PUT" && path.includes("devices") ? { token: "x", platform: "ios" } : undefined)).status, 401, path);
  }
  assert.equal((await call("PUT", "/me/notifications/not-a-uuid/read")).body.error.code, "VALIDATION_ERROR");
  assert.equal((await call("PUT", `/me/notifications/${randomUUID()}/read`)).status, 404);
  assert.equal((await call("GET", "/me/notifications?limit=51")).body.error.code, "VALIDATION_ERROR");
  assert.equal((await call("GET", "/me/notifications?cursor=bozuk")).body.error.code, "INVALID_CURSOR");
  assert.equal((await call("POST", "/me/notifications/read-all", actors[0], { before: "dün" })).body.error.code, "VALIDATION_ERROR");
  assert.equal((await call("POST", "/me/notifications/read-all", actors[0], { all: true })).body.error.code, "VALIDATION_ERROR");
  assert.equal((await call("PUT", "/me/devices/not-a-uuid", actors[0], { token: "x", platform: "ios" })).body.error.code, "VALIDATION_ERROR");
  for (const body of [{ token: "x", platform: "web" }, { token: "", platform: "ios" }, { token: "a b", platform: "ios" }, { token: "x".repeat(513), platform: "ios" },
    { platform: "ios" }, { token: "x", platform: "ios", userId: actors[1].id }]) {
    assert.equal((await call("PUT", `/me/devices/${randomUUID()}`, actors[0], body)).body.error.code, "VALIDATION_ERROR", JSON.stringify(body));
  }
  const empty = await list(actors[0]);
  assert.deepEqual(empty.items, []); assert.equal(empty.unreadCount, 0); assert.equal(empty.nextCursor, null); assert.ok(empty.serverNow);
});

test("arkadaşlık isteği alıcıya, kabul gönderene bildirim ve genel metinli push üretir", async () => {
  const [a, b] = actors; const phoneB = await device(b); const phoneA = await device(a);
  await request(a, b);
  assert.deepEqual((await list(b)).items, [], "bildirim olay işlenince oluşur");
  await drain();
  const incoming = await list(b);
  assert.equal(incoming.unreadCount, 1); assert.equal(incoming.items.length, 1);
  const item = incoming.items[0];
  assert.deepEqual(Object.keys(item).sort(), ["actor", "count", "createdAt", "id", "isRead", "readAt", "target", "type"]);
  assert.equal(item.type, "friend.request.received"); assert.equal(item.isRead, false); assert.equal(item.count, 1);
  assert.deepEqual(Object.keys(item.actor).sort(), ["avatarPath", "displayName", "id", "username"]);
  assert.equal(item.actor.id, a.id); assert.deepEqual(item.target, { type: "USER", id: a.id, title: null });
  assert.deepEqual((await list(a)).items, [], "isteği gönderen kendi işleminden bildirim almaz");
  let sent = await pushes();
  assert.equal(sent.length, 1); assert.equal(sent[0].to, phoneB.token); assert.equal(sent[0].title, "Podyum");
  assert.equal(sent[0].body, "Yeni bir arkadaşlık isteğin var.");
  assert.deepEqual(sent[0].data, { notificationId: item.id, type: "friend.request.received", targetType: "USER", targetId: a.id });
  // Kilit ekranı metni kimden geldiğini taşımaz.
  assert.ok(!JSON.stringify({ title: sent[0].title, body: sent[0].body }).includes(item.actor.username));

  assert.equal((await call("POST", `/friend-requests/${a.id}/accept`, b)).status, 200);
  await drain();
  const accepted = await list(a);
  assert.equal(accepted.items.length, 1); assert.equal(accepted.items[0].type, "friend.request.accepted"); assert.equal(accepted.items[0].actor.id, b.id);
  assert.deepEqual((await list(b)).items, [], "sonuçlanan isteğin bildirimi kalkar");
  sent = await pushes();
  assert.equal(sent.length, 2); assert.equal(sent[1].to, phoneA.token); assert.equal(sent[1].body, "Arkadaşlık isteğin kabul edildi.");
  // Aynı olay ikinci kez uygulanmaz.
  assert.equal(await drain(), 0);
  assert.equal(await db.notification.count({ where: { userId: { in: [a.id, b.id] } } }), 1);
  assert.equal((await pushes()).length, 2);
});

test("iptal, red ve engel bekleyen istek bildirimini kaldırır; geç işlenen olay geçersiz bildirim üretmez", async () => {
  const [a, b, c, d] = actors;
  await request(a, b); await drain();
  assert.equal((await list(b)).unreadCount, 1);
  assert.equal((await call("DELETE", `/friend-requests/${b.id}`, a)).status, 200);
  await drain();
  assert.deepEqual((await list(b)).items, []); assert.equal((await list(b)).unreadCount, 0);
  // İstek işlenmeden geri çekildi veya gönderen engellendi: güncel durum okunur.
  await request(a, c); assert.equal((await call("DELETE", `/friend-requests/${c.id}`, a)).status, 200);
  await request(a, d); assert.equal((await call("PUT", `/blocks/${a.id}`, d)).status, 200);
  await drain();
  assert.deepEqual((await list(c)).items, []); assert.deepEqual((await list(d)).items, []);
  // Reddedilip yeniden gönderilen istek tek satırdır.
  await request(a, b); await drain();
  assert.equal((await call("POST", `/friend-requests/${a.id}/decline`, b)).status, 200);
  await request(a, b); await drain();
  const again = await list(b);
  assert.equal(again.items.length, 1); assert.equal(again.unreadCount, 1);
  assert.deepEqual((await list(a)).items, [], "red karşı tarafa bildirilmez");
  assert.equal((await pushes()).length, 0, "kayıtlı cihaz yoksa push yazılmaz");
});

test("yorumlar paylaşım başına tek okunmamış bildirimde gruplanır; push yalnız grubun ilk yorumunda gider", async () => {
  const [a, b, c] = actors; await device(a);
  const row = await poll(a); await vote(row, b); await vote(row, c);
  await comment(row, b, "Gizli yorum metni"); await drain();
  let mine = await list(a);
  assert.equal(mine.items.length, 1);
  assert.equal(mine.items[0].type, "poll.comment.received"); assert.equal(mine.items[0].count, 1); assert.equal(mine.items[0].actor.id, b.id);
  assert.deepEqual(mine.items[0].target, { type: "POLL", id: row.id, title: "Hangisi daha iyi?" });
  const groupId = mine.items[0].id;
  let sent = await pushes();
  assert.equal(sent.length, 1); assert.equal(sent[0].body, "Paylaşımına yeni yorum geldi.");
  assert.ok(!JSON.stringify(sent[0]).includes("Gizli yorum metni")); assert.ok(!JSON.stringify(sent[0]).includes("Hangisi daha iyi"));

  await comment(row, c); const last = await comment(row, b); await comment(row, a, "Kendi yorumum"); await drain();
  mine = await list(a);
  assert.equal(mine.items.length, 1); assert.equal(mine.items[0].id, groupId);
  assert.equal(mine.items[0].count, 3); assert.equal(mine.items[0].actor.id, b.id); assert.equal(mine.unreadCount, 1);
  assert.equal((await pushes()).length, 1);
  assert.deepEqual((await list(b)).items, [], "yorum yazan veya başka yorumcu bildirim almaz");
  // Kaldırılan yorum sayıdan düşer; son yazan güncellenir.
  assert.equal((await call("DELETE", `/comments/${last}`, b)).status, 200); await drain();
  mine = await list(a);
  assert.equal(mine.items[0].count, 2); assert.equal(mine.items[0].actor.id, c.id);

  // Okununca grup kapanır; sonraki yorum yeni bildirim ve yeni push üretir.
  assert.equal((await call("PUT", `/me/notifications/${groupId}/read`, a)).status, 200);
  const fresh = await comment(row, b); await drain();
  mine = await list(a);
  assert.equal(mine.items.length, 2); assert.equal(mine.unreadCount, 1);
  assert.equal(mine.items[0].isRead, false); assert.equal(mine.items[0].count, 1);
  assert.equal(mine.items[1].id, groupId); assert.equal(mine.items[1].isRead, true); assert.equal(mine.items[1].count, 2);
  sent = await pushes(); assert.equal(sent.length, 2);
  // Gruptaki tek yorum kaldırılırsa okunmamış bildirim de kalkar.
  assert.equal((await call("DELETE", `/comments/${fresh}`, a)).status, 200); await drain();
  mine = await list(a);
  assert.equal(mine.items.length, 1); assert.equal(mine.unreadCount, 0);
});

test("oylama kapanınca sahibe push'lu, oy verenlere yalnız uygulama içi bildirim gider", async () => {
  const [a, b, c, d] = actors; await device(a); await device(b); await device(c);
  const row = await poll(a); await vote(row, b); await vote(row, c);
  assert.equal((await call("PUT", `/blocks/${c.id}`, a)).status, 200);
  await close(row); await drain();
  const own = await list(a);
  assert.equal(own.items.length, 1); assert.equal(own.items[0].type, "poll.result.own"); assert.equal(own.items[0].actor, null);
  assert.deepEqual(own.items[0].target, { type: "POLL", id: row.id, title: "Hangisi daha iyi?" });
  const voted = await list(b);
  assert.equal(voted.items.length, 1); assert.equal(voted.items[0].type, "poll.result.voted"); assert.equal(voted.unreadCount, 1);
  assert.deepEqual((await list(c)).items, [], "engellenen oy veren bildirim almaz");
  assert.deepEqual((await list(d)).items, [], "oy vermeyen bildirim almaz");
  const sent = await pushes();
  assert.equal(sent.length, 1); assert.equal(sent[0].body, "Oylaman sonuçlandı."); assert.equal(sent[0].data.targetId, row.id);
  // Gizlenmiş paylaşımın kapanışı kimseye bildirilmez.
  const hidden = await poll(a, { contentStatus: "HIDDEN" }); await db.pollVote.create({ data: { pollId: hidden.id, voterId: b.id, optionId: hidden.options[0].id } });
  await close(hidden); await drain();
  assert.equal(await db.notification.count({ where: { resourceId: hidden.id } }), 0);
  assert.equal((await pushes()).length, 1);
});

test("oyunda oylama başlayınca ve sonuç açıklanınca etkin üyelere bildirim gider", async () => {
  const [a, b, c, d] = actors; await device(b);
  const lobby = await call("POST", "/games/lobbies", a, { themeTitle: "90'lar", submissionSeconds: 60, votingSeconds: 120 });
  assert.equal(lobby.status, 201, JSON.stringify(lobby.body)); const id = lobby.body.id as string; sessions.push(id);
  const command = async (action: string) => {
    const version = (await call("GET", `/games/${id}`, a)).body.version;
    const result = await call("POST", `/games/${id}/${action}`, a, { expectedVersion: version });
    assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body;
  };
  const grant = await command("invite");
  for (const member of [b, c, d]) assert.equal((await call("POST", "/games/join", member, { token: grant.token })).status, 200);
  await command("start");
  for (const member of [a, b]) {
    const media = await db.mediaAsset.create({ data: { ownerId: member.id, purpose: "GAME", status: "READY", uploadKey: `test-${randomUUID()}`,
      displayKey: `test-${randomUUID()}`, thumbnailKey: `test-${randomUUID()}`, previewAcceptedAt: new Date() } });
    assert.equal((await call("PUT", `/games/${id}/submission`, member, { mediaId: media.id })).status, 200);
  }
  // Ayrılan üye bildirim almaz.
  const left = await call("POST", `/games/${id}/leave`, d, {});
  assert.equal(left.status, 200, JSON.stringify(left.body));
  assert.equal((await command("end-submission")).phase, "VOTING");
  await drain();
  for (const member of [a, b, c]) {
    const items = (await list(member)).items;
    assert.equal(items.length, 1, "fotoğraf göndermeyen üye de oylamaya çağrılır"); assert.equal(items[0].type, "game.voting.opened");
    assert.deepEqual(items[0].target, { type: "GAME", id, title: "90'lar" }); assert.equal(items[0].actor, null);
  }
  assert.deepEqual((await list(d)).items, []);
  let sent = await pushes();
  assert.equal(sent.length, 1); assert.equal(sent[0].body, "Oylama başladı. Fotoğrafları değerlendirme zamanı."); assert.equal(sent[0].ttlSeconds, 1800);
  assert.deepEqual(sent[0].data.targetType, "GAME");

  const now = Date.now();
  await db.gameSession.update({ where: { id }, data: { startsAt: new Date(now - 180000), submissionEndsAt: new Date(now - 120000),
    votingStartsAt: new Date(now - 120000), votingEndsAt: new Date(now - 1000) } });
  await app.get(GameLifecycleService).scan();
  assert.equal((await db.gameSession.findUniqueOrThrow({ where: { id } })).phase, "COMPLETED");
  await drain();
  const done = (await list(b)).items;
  assert.deepEqual(done.map((item: any) => item.type), ["game.completed"], "okunmamış oylama çağrısı sonuçla yer değiştirir");
  sent = await pushes();
  assert.equal(sent.length, 2); assert.equal(sent[1].body, "Oyunun sonuçları açıklandı.");
});

test("tercihler yalnız push'u kapatır; çıkış yapan veya iptal edilen oturumun cihazı push almaz", async () => {
  const [a, b, c, d] = actors;
  await device(b); await device(c); await device(d); const phoneA = await device(a);
  assert.equal((await call("PATCH", "/me/settings", b, { friendRequestNotifications: false })).status, 200);
  assert.equal((await call("PATCH", "/me/settings", c, { pushEnabled: false })).status, 200);
  assert.equal((await call("PATCH", "/me/settings", d, { commentNotifications: false, gameNotifications: false })).body.gameNotifications, false);
  await request(a, b); await request(a, c); await request(a, d); await drain();
  for (const actor of [b, c, d]) assert.equal((await list(actor)).unreadCount, 1, "uygulama içi bildirim tercihten bağımsızdır");
  const sent = await pushes();
  assert.equal(sent.length, 1, "yalnız ilgili türü ve push'u açık olan kişi push alır");
  assert.equal(sent[0].data.targetId, a.id);
  assert.equal((await db.deviceToken.findMany({ where: { userId: d.id } }))[0].token, sent[0].to);

  // İptal edilmiş oturumun kaydı durur ama kullanılmaz; çıkış kaydı siler.
  const row = await poll(a); await vote(row, b);
  await db.authSession.updateMany({ where: { userId: a.id }, data: { revokedAt: new Date() } });
  await comment(row, b); await drain();
  assert.equal(await db.notification.count({ where: { userId: a.id, type: "poll.comment.received" } }), 1);
  assert.equal((await pushes()).length, 1);
  assert.equal(await db.deviceToken.count({ where: { installationId: phoneA.installationId } }), 1);
  assert.equal((await call("POST", "/auth/logout", d)).status, 200);
  assert.equal(await db.deviceToken.count({ where: { userId: d.id } }), 0);
});

test("liste son etkinliğe göre sayfalanır; engellenen kişinin bildirimi listede ve sayaçta görünmez", async () => {
  const [a, b, c] = actors; const visible = await poll(b); const closed = await poll(b, { visibility: "FRIENDS" });
  const at = Date.now() - 600000;
  await db.notification.createMany({ data: [
    { userId: a.id, eventId: randomUUID(), type: "friend.request.accepted", resourceType: "user", resourceId: b.id, actorId: b.id, activityAt: new Date(at) },
    { userId: a.id, eventId: randomUUID(), type: "poll.result.voted", resourceType: "poll", resourceId: visible.id, activityAt: new Date(at + 1000) },
    { userId: a.id, eventId: randomUUID(), type: "poll.result.voted", resourceType: "poll", resourceId: closed.id, activityAt: new Date(at + 2000) },
    { userId: a.id, eventId: randomUUID(), type: "friend.request.received", resourceType: "user", resourceId: c.id, actorId: c.id, activityAt: new Date(at + 3000) },
    { userId: a.id, eventId: randomUUID(), type: "legacy.unknown", resourceType: "poll", resourceId: visible.id, activityAt: new Date(at + 4000) },
  ] });
  const first = await call("GET", "/me/notifications?limit=2", a);
  assert.deepEqual(first.body.items.map((item: any) => item.type), ["friend.request.received", "poll.result.voted"]);
  assert.equal(first.body.unreadCount, 4, "bilinmeyen tür listelenmez ve sayılmaz"); assert.ok(first.body.nextCursor);
  // Bildirim erişim vermez: artık görülemeyen paylaşımın başlığı dönmez.
  assert.deepEqual(first.body.items[1].target, { type: "POLL", id: closed.id, title: null });
  const second = await call("GET", `/me/notifications?limit=2&cursor=${first.body.nextCursor}`, a);
  assert.deepEqual(second.body.items.map((item: any) => item.type), ["poll.result.voted", "friend.request.accepted"]);
  assert.equal(second.body.items[0].target.title, "Hangisi daha iyi?"); assert.equal(second.body.nextCursor, null);
  assert.equal((await call("GET", `/me/notifications?cursor=${first.body.nextCursor}`, b)).body.error.code, "INVALID_CURSOR");
  assert.deepEqual((await list(b)).items, []);
  assert.equal((await call("PUT", `/blocks/${a.id}`, c)).status, 200);
  const after = await list(a);
  assert.equal(after.items.length, 3); assert.ok(after.items.every((item: any) => item.actor?.id !== c.id)); assert.equal(after.unreadCount, 3);
  assert.deepEqual((await call("GET", "/me/notifications/unread-count", a)).body, { unreadCount: 3 });
  await db.user.update({ where: { id: b.id }, data: { status: "SUSPENDED" } });
  assert.deepEqual((await call("GET", "/me/notifications/unread-count", a)).body, { unreadCount: 2 });
});

test("okundu işareti tekrarlanabilir; toplu okuma yalnız verilen ana kadar olanları kapsar", async () => {
  const [a, b] = actors; const at = Date.now() - 600000;
  await db.notification.createMany({ data: [0, 1, 2].map((index) => ({ userId: a.id, eventId: randomUUID(), type: "poll.result.voted",
    resourceType: "poll", resourceId: randomUUID(), activityAt: new Date(at + index * 60000) })) });
  const before = await list(a); const [newest, middle, oldest] = before.items;
  const read = await call("PUT", `/me/notifications/${oldest.id}/read`, a);
  assert.equal(read.status, 200); assert.equal(read.body.isRead, true); assert.ok(read.body.readAt);
  assert.deepEqual((await call("PUT", `/me/notifications/${oldest.id}/read`, a)).body, read.body, "ilk okunma zamanı korunur");
  assert.equal((await call("PUT", `/me/notifications/${oldest.id}/read`, b)).status, 404);
  assert.equal((await list(a)).unreadCount, 2);
  const partial = await call("POST", "/me/notifications/read-all", a, { before: middle.createdAt });
  assert.deepEqual(partial.body, { updated: 1, unreadCount: 1 });
  const state = await list(a);
  assert.deepEqual(state.items.map((item: any) => [item.id, item.isRead]), [[newest.id, false], [middle.id, true], [oldest.id, true]]);
  assert.deepEqual((await call("POST", "/me/notifications/read-all", a)).body, { updated: 1, unreadCount: 0 });
  assert.deepEqual((await call("POST", "/me/notifications/read-all", a)).body, { updated: 0, unreadCount: 0 });
  assert.equal((await call("POST", "/me/notifications/read-all", b)).body.updated, 0, "başkasının bildirimi etkilenmez");
});

test("cihaz kaydı kuruluma ve oturuma bağlıdır; anahtar taşınır ve kişi başı sınır korunur", async () => {
  const [a, b] = actors; const installationId = randomUUID();
  const first = await call("PUT", `/me/devices/${installationId}`, a, { token: "token-1", platform: "android" });
  assert.equal(first.status, 200);
  assert.deepEqual(Object.keys(first.body).sort(), ["installationId", "platform", "updatedAt"], "anahtar yanıtta geri dönmez");
  assert.equal((await call("PUT", `/me/devices/${installationId}`, a, { token: "token-2", platform: "android" })).status, 200);
  let rows = await db.deviceToken.findMany({ where: { installationId } });
  assert.equal(rows.length, 1); assert.equal(rows[0].token, "token-2"); assert.equal(rows[0].userId, a.id);
  assert.equal((await db.authSession.findUniqueOrThrow({ where: { id: rows[0].sessionId } })).userId, a.id);
  // Başkası bu kurulumu silemez; aynı telefonda giriş yapınca kayıt ona geçer.
  assert.deepEqual((await call("DELETE", `/me/devices/${installationId}`, b)).body, { installationId, removed: true });
  assert.equal(await db.deviceToken.count({ where: { installationId } }), 1);
  assert.equal((await call("PUT", `/me/devices/${installationId}`, b, { token: "token-2", platform: "android" })).status, 200);
  rows = await db.deviceToken.findMany({ where: { installationId } });
  assert.equal(rows.length, 1); assert.equal(rows[0].userId, b.id);
  // Yeniden kurulum: aynı anahtar yeni kurulum kimliğiyle gelir, eski satır kalkar.
  const reinstalled = randomUUID();
  assert.equal((await call("PUT", `/me/devices/${reinstalled}`, a, { token: "token-2", platform: "android" })).status, 200);
  assert.deepEqual((await db.deviceToken.findMany({ where: { token: "token-2" } })).map((row) => [row.installationId, row.userId]), [[reinstalled, a.id]]);
  assert.deepEqual((await call("DELETE", `/me/devices/${reinstalled}`, a)).body, { installationId: reinstalled, removed: true });
  assert.equal((await call("DELETE", `/me/devices/${reinstalled}`, a)).status, 200);
  assert.equal(await db.deviceToken.count({ where: { userId: a.id } }), 0);
  for (let index = 0; index < 11; index++) await device(a, `many-${index}-${randomUUID()}`);
  const kept = await db.deviceToken.findMany({ where: { userId: a.id } });
  assert.equal(kept.length, 10); assert.ok(!kept.some((row) => row.token.startsWith("many-0-")), "en eski kayıt düşer");
  const session = (await db.authSession.findFirstOrThrow({ where: { userId: a.id } })).id;
  await assert.rejects(db.deviceToken.create({ data: { userId: a.id, installationId: randomUUID(), sessionId: session, token: randomUUID(), platform: "web" } }));
  await assert.rejects(db.notification.create({ data: { userId: a.id, eventId: randomUUID(), type: "x", resourceType: "user", resourceId: a.id, actorId: a.id } }));
  await assert.rejects(db.notification.create({ data: { userId: a.id, eventId: randomUUID(), type: "x", resourceType: "user", resourceId: a.id, count: 0 } }));
});

test("Expo sağlayıcısı: geçersiz cihaz silinir; servise ulaşılamazsa push sonra yeniden denenir", async () => {
  const requests: { authorization: string | undefined; messages: any[] }[] = []; let healthy = true;
  stub = createServer((incoming, outgoing) => {
    let raw = ""; incoming.on("data", (chunk) => { raw += chunk; });
    incoming.on("end", () => {
      const messages = JSON.parse(raw) as any[]; requests.push({ authorization: incoming.headers.authorization, messages });
      if (!healthy) { outgoing.writeHead(503).end("{}"); return; }
      outgoing.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ data: messages.map((message) => message.to.includes("gone")
        ? { status: "error", message: "not registered", details: { error: "DeviceNotRegistered" } } : { status: "ok", id: randomUUID() }) }));
    });
  });
  await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
  await app.close();
  process.env.PUSH_PROVIDER = "expo"; process.env.EXPO_PUSH_URL = `http://127.0.0.1:${(stub.address() as AddressInfo).port}/send`; process.env.EXPO_ACCESS_TOKEN = "test-access";
  await start();
  const [a, b, c] = actors; const tag = randomUUID().slice(0, 8);
  const good = `ExponentPushToken[good-${tag}]`; const gone = `ExponentPushToken[gone-${tag}]`; const foreign = `fcm-${tag}`;
  await device(b, good); await device(b, gone); await device(b, foreign);
  await request(a, b); await drain();
  assert.equal(requests.length, 1); assert.equal(requests[0].authorization, "Bearer test-access");
  assert.deepEqual(requests[0].messages.map((message) => message.to).sort(), [gone, good].sort(), "Expo biçiminde olmayan anahtar servise gönderilmez");
  assert.deepEqual(Object.keys(requests[0].messages[0]).sort(), ["body", "data", "sound", "title", "to", "ttl"]);
  assert.equal(requests[0].messages[0].body, "Yeni bir arkadaşlık isteğin var."); assert.equal(requests[0].messages[0].ttl, 86400);
  assert.deepEqual((await db.deviceToken.findMany({ where: { userId: b.id } })).map((row) => row.token), [good]);
  assert.equal((await pushes()).length, 0, "expo sağlayıcısı yerel dosya yazmaz");

  healthy = false; await device(c, `ExponentPushToken[c-${tag}]`);
  await request(a, c); await drain();
  assert.equal((await list(c)).unreadCount, 1, "push gitmese de uygulama içi bildirim durur");
  const notification = await db.notification.findFirstOrThrow({ where: { userId: c.id } });
  let event = await db.outboxEvent.findFirstOrThrow({ where: { aggregateId: notification.id, type: "notification.created" } });
  assert.equal(event.publishedAt, null); assert.equal(event.attempts, 1); assert.equal(event.leaseUntil, null);
  assert.ok(event.availableAt.getTime() > Date.now() + 5000, "yeniden deneme ertelenir");
  const failed = requests.length;
  assert.equal(await drain(), 0); assert.equal(requests.length, failed, "bekleme süresi dolmadan tekrar denenmez");
  healthy = true; await db.outboxEvent.update({ where: { id: event.id }, data: { availableAt: new Date(Date.now() - 1000) } });
  assert.equal(await drain(), 1);
  event = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
  assert.ok(event.publishedAt); assert.equal(event.attempts, 2); assert.equal(requests.length, failed + 1);
  assert.equal(await db.deviceToken.count({ where: { userId: c.id } }), 1);
});

test("olay kuyruğu: tüketicisiz tür yayınlandı sayılır, eski olay bildirim üretmez, deneme sınırı dolan olay bekler", async () => {
  const [a, b] = actors; const row = await poll(a); await vote(row, b);
  const report = await call("POST", "/reports", b, { targetType: "POLL", targetId: row.id, reason: "SPAM" });
  assert.equal(report.status, 201);
  await db.poll.update({ where: { id: row.id }, data: { status: "CLOSED", closedAt: new Date() } });
  const payload = { schemaVersion: 1, pollId: row.id, authorId: a.id, version: 2, status: "CLOSED", visibility: "PUBLIC" };
  const stale = await db.outboxEvent.create({ data: { aggregateType: "poll", aggregateId: row.id, aggregateVersion: 2, type: "poll.closed", payload, createdAt: new Date(Date.now() - 4 * 86400000) } });
  const parked = await db.outboxEvent.create({ data: { aggregateType: "poll", aggregateId: row.id, aggregateVersion: 3, type: "poll.closed", payload, attempts: 12 } });
  await drain();
  const events = await db.outboxEvent.findMany({ where: { aggregateId: { in: [row.id, report.body.id] } } });
  assert.ok(events.filter((event) => event.id !== parked.id).every((event) => event.publishedAt && event.leaseUntil === null), "oy ve şikâyet olayları da kapanır");
  assert.ok((await db.outboxEvent.findUniqueOrThrow({ where: { id: stale.id } })).publishedAt);
  assert.equal((await db.outboxEvent.findUniqueOrThrow({ where: { id: parked.id } })).publishedAt, null);
  assert.equal(await db.notification.count({ where: { resourceId: row.id } }), 0);
  // Aynı olay güncelken sahibine ve oy verene birer bildirim üretir.
  await db.outboxEvent.create({ data: { aggregateType: "poll", aggregateId: row.id, aggregateVersion: 4, type: "poll.closed", payload } });
  await drain();
  assert.deepEqual((await db.notification.findMany({ where: { resourceId: row.id }, orderBy: { type: "asc" } })).map((item) => [item.userId, item.type]),
    [[a.id, "poll.result.own"], [b.id, "poll.result.voted"]]);
});

test("OpenAPI bildirim ve cihaz uçlarını, tür listesini ve oyun bildirimi tercihini belgeler", async () => {
  const schema = (await call("GET", "/openapi.json", null)).body; const paths = schema.paths;
  for (const [path, method] of [["/v1/me/notifications", "get"], ["/v1/me/notifications/unread-count", "get"], ["/v1/me/notifications/read-all", "post"],
    ["/v1/me/notifications/{id}/read", "put"], ["/v1/me/devices/{installationId}", "put"], ["/v1/me/devices/{installationId}", "delete"]]) {
    assert.ok(paths[path][method].security.some((item: any) => "bearer" in item), `${method} ${path}`);
    assert.ok(!(paths[path][method].parameters ?? []).some((item: any) => item.name === "Idempotency-Key"));
  }
  assert.deepEqual(schema.components.schemas.NotificationDto.properties.type.enum, ["friend.request.received", "friend.request.accepted",
    "poll.comment.received", "poll.result.own", "poll.result.voted", "game.voting.opened", "game.completed"]);
  assert.deepEqual(schema.components.schemas.NotificationTargetDto.properties.type.enum, ["USER", "POLL", "GAME"]);
  assert.ok(!schema.components.schemas.DeviceReceiptDto.properties.token);
  assert.ok(schema.components.schemas.SettingsResponseDto.properties.gameNotifications);
  assert.ok(schema.components.schemas.UpdateSettingsDto.properties.gameNotifications);
});
