import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import sharp from "sharp";
import { io, type Socket } from "socket.io-client";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const load = (path: string) => import(new URL(`../dist/${path}.js`, import.meta.url).href);
const { createApp } = await load("create-app") as { createApp: () => Promise<NestExpressApplication> };
const { PrismaService } = await load("database/prisma.service");
const { LocalMediaStorage } = await load("modules/media/local-media-storage.service");
const { OutboxDispatcher } = await load("common/outbox/outbox-dispatcher");
type Actor = { id: string; token: string; subject: string };
let app: NestExpressApplication; let db: PrismaClient; let origin: string; let directory: string;
let actors: Actor[]; let polls: string[]; let games: string[]; let clients: Socket[];
const envKeys = ["NODE_ENV", "AUTH_MOCK_ENABLED", "LOCAL_MEDIA_DIR", "LOCAL_PUSH_DIR", "PUSH_PROVIDER", "DAILY_GAME_START_TIME", "DAILY_GAME_TIME_ZONE", "DAILY_GAME_THEME_SLUG"] as const;
const original = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const photo = await sharp({ create: { width: 32, height: 40, channels: 3, background: "#884455" } }).webp().toBuffer();
async function http(method: string, path: string, actor: Actor | null = actors[0], body?: unknown, key: string | null = randomUUID()) {
  const response = await fetch(`${origin}/v1${path}`, { method, headers: { ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}),
    ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(key ? { "Idempotency-Key": key } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  return { status: response.status, body: await response.json() as any };
}
async function ok(method: string, path: string, actor = actors[0], body?: unknown, key?: string) {
  const result = await http(method, path, actor, body, key); assert.ok(result.status < 300, JSON.stringify(result)); return result.body;
}
async function poll(visibility: "PUBLIC" | "FRIENDS" = "PUBLIC") {
  const row = await db.poll.create({ data: { authorId: actors[1].id, question: "Özel kombin sorusu", category: "OUTFIT", status: "OPEN", visibility,
    publishedAt: new Date(Date.now() - 10000), closesAt: new Date(Date.now() + 1800000),
    options: { create: [1, 2].map((position) => ({ position, media: { create: { ownerId: actors[1].id, purpose: "POLL", status: "READY",
      uploadKey: `original-${randomUUID()}`, displayKey: `display-${randomUUID()}`, thumbnailKey: `thumb-${randomUUID()}`, previewAcceptedAt: new Date() } } })) } },
    include: { options: { include: { media: true }, orderBy: { position: "asc" } } } });
  polls.push(row.id);
  for (const option of row.options) { await app.get(LocalMediaStorage).write(option.media.displayKey, photo); await app.get(LocalMediaStorage).write(option.media.thumbnailKey, photo); }
  if (visibility === "FRIENDS") {
    const [userAId, userBId] = [actors[1].id, actors[2].id].sort(); await db.friendship.create({ data: { userAId, userBId, requesterId: actors[1].id, status: "ACCEPTED" } });
  }
  return row;
}
async function report(targetType: "POLL" | "COMMENT" | "USER", targetId: string) {
  return ok("POST", "/reports", actors[2], { targetType, targetId, reason: "INAPPROPRIATE", note: "Özel şikâyet açıklaması" });
}
const review = (id: string, decision = "DISMISS", key = randomUUID(), actor = actors[0]) => http("PUT", `/admin/reports/${id}/decision`, actor, { decision, reason: "İnceleme gerekçesi", expectedVersion: 0 }, key);
async function media(path: string, actor: Actor | null = actors[0]) {
  const response = await fetch(`${origin}/v1${path}`, { headers: actor ? { Authorization: `Bearer ${actor.token}` } : {} });
  return { status: response.status, headers: response.headers, buffer: Buffer.from(await response.arrayBuffer()) };
}
async function game() {
  const row = await ok("POST", "/games/lobbies", actors[1], { themeTitle: "Gizli tema", submissionSeconds: 60, votingSeconds: 60 }); games.push(row.id);
  const invite = await ok("POST", `/games/${row.id}/invite`, actors[1], { expectedVersion: row.version });
  await ok("POST", "/games/join", actors[2], { token: invite.token }); return { ...row, token: invite.token };
}
function event(client: Socket, name: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const listener = (value: unknown) => { clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => { client.off(name, listener); reject(new Error(`Socket timeout: ${name}`)); }, 5000); client.once(name, listener);
  });
}
async function connect(actor: Actor) {
  const client = io(`${origin}/games`, { transports: ["websocket"], auth: { accessToken: actor.token }, autoConnect: false, reconnection: false });
  clients.push(client); const connected = event(client, "connect"); client.connect(); await connected; return client;
}

beforeEach(async () => {
  process.env.NODE_ENV = "test"; process.env.AUTH_MOCK_ENABLED = "true"; process.env.PUSH_PROVIDER = "local";
  delete process.env.DAILY_GAME_START_TIME; delete process.env.DAILY_GAME_TIME_ZONE; delete process.env.DAILY_GAME_THEME_SLUG;
  directory = await mkdtemp(join(tmpdir(), "podyum-admin-")); process.env.LOCAL_MEDIA_DIR = join(directory, "media"); process.env.LOCAL_PUSH_DIR = join(directory, "push");
  actors = []; polls = []; games = []; clients = [];
  app = await createApp(); await app.listen(0, "127.0.0.1"); origin = await app.getUrl(); db = app.get(PrismaService);
  for (let index = 0; index < 4; index++) {
    const subject = `moderation_${randomUUID()}`;
    const session = await http("POST", "/auth/mock", null, { provider: "google", subject, acknowledgeMock: true }); assert.equal(session.status, 200);
    const actor = { id: "", token: session.body.accessToken, subject }; actor.id = (await ok("GET", "/auth/me", actor)).user.id;
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: actor.id } })).role, "USER"); actors.push(actor);
  }
  await db.user.update({ where: { id: actors[0].id }, data: { role: "ADMIN" } });
});
afterEach(async () => {
  try {
    for (const client of clients) client.disconnect();
    const users = actors.map((actor) => actor.id);
    await db.$transaction(async (tx) => {
      const comments = (await tx.comment.findMany({ where: { pollId: { in: polls } }, select: { id: true } })).map((row) => row.id);
      const reports = (await tx.report.findMany({ where: { reporterId: { in: users } }, select: { id: true } })).map((row) => row.id);
      const resources = [...users, ...polls, ...games, ...comments, ...reports];
      const audits = (await tx.moderationAudit.findMany({ where: { OR: [{ actorId: { in: users } }, { resourceId: { in: resources } }] }, select: { id: true } })).map((row) => row.id);
      await tx.outboxEvent.deleteMany({ where: { OR: [{ aggregateId: { in: [...resources, ...audits] } },
        ...users.map((userId) => ({ type: "notification.created", payload: { path: ["userId"], equals: userId } }))] } });
      await tx.moderationAudit.deleteMany({ where: { id: { in: audits } } });
      await tx.notification.deleteMany({ where: { userId: { in: users } } });
      await tx.idempotencyRecord.deleteMany({ where: { userId: { in: users } } });
      await tx.report.deleteMany({ where: { id: { in: reports } } });
      await tx.gameOutcome.deleteMany({ where: { sessionId: { in: games } } });
      await tx.gameScore.deleteMany({ where: { sessionId: { in: games } } });
      await tx.gameSubmission.deleteMany({ where: { sessionId: { in: games } } });
      await tx.gameMembership.deleteMany({ where: { sessionId: { in: games } } });
      await tx.gameSession.deleteMany({ where: { id: { in: games } } });
      await tx.pollVoteReason.deleteMany({ where: { pollId: { in: polls } } });
      await tx.comment.deleteMany({ where: { id: { in: comments } } });
      await tx.pollSave.deleteMany({ where: { pollId: { in: polls } } });
      await tx.pollVote.deleteMany({ where: { pollId: { in: polls } } });
      await tx.pollOption.deleteMany({ where: { pollId: { in: polls } } });
      await tx.poll.deleteMany({ where: { id: { in: polls } } });
      await tx.mediaAsset.deleteMany({ where: { ownerId: { in: users } } });
      await tx.block.deleteMany({ where: { OR: [{ blockerId: { in: users } }, { blockedId: { in: users } }] } });
      await tx.friendship.deleteMany({ where: { OR: [{ userAId: { in: users } }, { userBId: { in: users } }] } });
      await tx.deviceToken.deleteMany({ where: { userId: { in: users } } });
      await tx.userPrivate.deleteMany({ where: { userId: { in: users } } });
      await tx.userSettings.deleteMany({ where: { userId: { in: users } } });
      await tx.usedRefreshToken.deleteMany({ where: { session: { userId: { in: users } } } });
      await tx.authSession.deleteMany({ where: { userId: { in: users } } });
      await tx.authIdentity.deleteMany({ where: { userId: { in: users } } });
      await tx.user.deleteMany({ where: { id: { in: users } } });
    }, { timeout: 30000 });
  } finally {
    await app?.close(); await rm(directory, { recursive: true, force: true });
    for (const key of envKeys) { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; }
  }
});

test("yönetim uçları oturum ve güncel ADMIN rolü ister; profil/kayıt rol yükseltemez", async () => {
  for (const path of ["/admin/me", "/admin/reports", "/admin/audit", `/admin/reports/${randomUUID()}`]) {
    assert.equal((await http("GET", path, null)).status, 401); assert.equal((await http("GET", path, actors[1])).body.error.code, "ADMIN_REQUIRED");
  }
  assert.equal((await ok("GET", "/admin/me")).role, "ADMIN");
  assert.equal((await http("PATCH", "/me", actors[1], { role: "ADMIN" })).status, 400);
  assert.equal((await http("POST", "/auth/mock", null, { provider: "google", subject: randomUUID(), acknowledgeMock: true, role: "ADMIN" })).status, 400);
  assert.equal((await http("PUT", `/admin/users/${actors[2].id}/status`, actors[1], { status: "SUSPENDED", reason: "Test" })).status, 403);
});

test("ilk yönetici yalnız yerel araçla ve denetim kaydıyla atanır; tekrar rol kaydı çoğaltmaz", async () => {
  const run = () => promisify(execFile)("npm", ["run", "admin:grant", "--", actors[3].id, "Yerel geliştirme yöneticisi"], { cwd: process.cwd(), env: process.env, timeout: 15000 });
  await run(); assert.equal((await ok("GET", "/admin/me", actors[3])).role, "ADMIN");
  const first = await db.moderationAudit.findFirstOrThrow({ where: { resourceId: actors[3].id } });
  assert.equal(first.action, "ROLE_GRANTED"); assert.equal(first.actorId, null); assert.deepEqual(first.after, { role: "ADMIN", source: "LOCAL_CLI" });
  await run(); assert.equal(await db.moderationAudit.count({ where: { resourceId: actors[3].id } }), 1);
});

test("yönetim DTO'ları sürüm, gerekçe, işlem anahtarı ve izinli durum değerlerini zorunlu tutar", async () => {
  const row = await poll(); const reported = await report("POLL", row.id);
  for (const body of [{ decision: "HIDE_POLL", expectedVersion: "0", reason: "Test" }, { decision: "HIDE_POLL", expectedVersion: 0, reason: " " },
    { decision: "WRONG", expectedVersion: 0, reason: "Test" }, { decision: "DISMISS", expectedVersion: 0, reason: "Test", actorId: actors[0].id }]) {
    assert.equal((await http("PUT", `/admin/reports/${reported.id}/decision`, actors[0], body)).status, 400);
  }
  assert.equal((await http("PUT", `/admin/reports/${reported.id}/decision`, actors[0], { decision: "DISMISS", expectedVersion: 0, reason: "Test" }, null)).body.error.code, "IDEMPOTENCY_KEY_REQUIRED");
  assert.equal((await http("GET", "/admin/reports?limit=51")).status, 400);
  assert.equal((await http("GET", "/admin/reports/bad")).status, 400);
  assert.equal((await http("GET", "/admin/reports?status=WRONG")).status, 400);
  assert.equal((await http("PUT", `/admin/users/${actors[1].id}/status`, actors[0], { status: "DELETED", reason: "Test" })).status, 400);
});

test("şikâyet kuyruğu filtreli ve kişiye bağlı cursor kullanır; özel hedefi yalnız yönetici inceler", async () => {
  const row = await poll("FRIENDS"); const reported = await report("POLL", row.id); const userReport = await report("USER", actors[1].id);
  await db.userPrivate.create({ data: { userId: actors[1].id, cityCode: "private-city" } });
  const first = await ok("GET", "/admin/reports?limit=1"); assert.equal(first.items.length, 1); assert.ok(first.nextCursor);
  const second = await ok("GET", `/admin/reports?limit=1&cursor=${first.nextCursor}`); assert.equal(second.items.length, 1); assert.notEqual(second.items[0].id, first.items[0].id);
  assert.equal((await http("GET", `/admin/reports?status=RESOLVED&cursor=${first.nextCursor}`)).body.error.code, "INVALID_CURSOR");
  assert.equal((await ok("GET", "/admin/reports?targetType=POLL")).items[0].id, reported.id);
  assert.equal((await ok("GET", "/admin/reports?targetType=USER")).items[0].id, userReport.id);
  const detail = await ok("GET", `/admin/reports/${reported.id}`);
  assert.equal(detail.target.question, row.question); assert.equal(detail.note, "Özel şikâyet açıklaması"); assert.equal(detail.reporter.id, actors[2].id);
  assert.equal(JSON.stringify(detail).includes("private-city"), false); assert.equal(JSON.stringify(detail).includes("Token"), false);
  assert.equal((await http("GET", `/polls/${row.id}`, actors[3])).status, 404);
  assert.equal((await http("GET", `/admin/reports/${reported.id}`, actors[3])).status, 403);
});

test("yönetici yalnız şikâyete bağlı onaylı işlenmiş görseli açabilir", async () => {
  const row = await poll(); const other = await poll(); const reported = await report("POLL", row.id); const id = row.options[0].mediaId;
  const path = `/admin/reports/${reported.id}/media/${id}/content`;
  const result = await media(path); assert.equal(result.status, 200); assert.equal(result.headers.get("cache-control"), "no-store"); assert.deepEqual(result.buffer, photo);
  assert.equal((await media(path, actors[2])).status, 403); assert.equal((await media(path, null)).status, 401);
  assert.equal((await media(`/admin/reports/${reported.id}/media/${other.options[0].mediaId}/content`)).status, 404);
  assert.equal((await media(`${path}?variant=original`)).status, 400);
  await db.mediaAsset.update({ where: { id }, data: { previewAcceptedAt: null } }); assert.equal((await media(path)).status, 404);
});

test("karar gerekçesi ve inceleyen kaydedilir; tekrar aynı makbuzu döndürür ve yeniden karar çatışır", async () => {
  const row = await poll(); const reported = await report("POLL", row.id); const key = randomUUID();
  const first = await review(reported.id, "DISMISS", key); assert.equal(first.status, 200); assert.equal(first.body.status, "DISMISSED");
  assert.deepEqual((await review(reported.id, "DISMISS", key)).body, first.body);
  assert.equal((await review(reported.id, "NO_ACTION", key)).body.error.code, "IDEMPOTENCY_KEY_REUSED");
  assert.equal((await review(reported.id)).body.error.code, "VERSION_CONFLICT");
  const stored = await db.report.findUniqueOrThrow({ where: { id: reported.id } }); assert.equal(stored.reviewedById, actors[0].id); assert.ok(stored.reviewedAt); assert.equal(stored.decisionNote, "İnceleme gerekçesi");
  assert.equal(await db.moderationAudit.count({ where: { reportId: reported.id } }), 1);
  const audit = await db.moderationAudit.findUniqueOrThrow({ where: { id: first.body.auditId } });
  const source = await db.outboxEvent.findFirstOrThrow({ where: { aggregateId: audit.id } });
  assert.equal(JSON.stringify(source.payload).includes(stored.decisionNote!), false); assert.equal(JSON.stringify(source.payload).includes("Özel şikâyet"), false);
});

test("şikâyet yaptırımı paylaşımı akış, detay, sonuç, kaydedilenler ve medya erişiminden çıkarır", async () => {
  const row = await poll(); const reported = await report("POLL", row.id);
  await ok("PUT", `/polls/${row.id}/save`, actors[2]); await ok("PUT", `/polls/${row.id}/vote`, actors[2], { optionId: row.options[0].id });
  assert.equal((await http("GET", `/polls/${row.id}/results`, actors[2])).status, 200);
  assert.ok((await ok("GET", "/feed", actors[3])).items.some((entry: any) => entry.id === row.id));
  assert.equal((await media(`/media/${row.options[0].mediaId}/content`, actors[2])).status, 200);
  assert.equal((await review(reported.id, "HIDE_POLL")).status, 200);
  assert.equal((await http("GET", `/polls/${row.id}`, actors[2])).status, 404);
  assert.equal((await http("GET", `/polls/${row.id}/results`, actors[2])).status, 404);
  assert.equal((await media(`/media/${row.options[0].mediaId}/content`, actors[2])).status, 404);
  assert.equal((await ok("GET", "/me/saved-polls", actors[2])).items.some((entry: any) => entry.id === row.id), false);
  assert.equal((await ok("GET", "/feed", actors[3])).items.some((entry: any) => entry.id === row.id), false);
  assert.equal((await ok("GET", `/admin/reports/${reported.id}`)).target.contentStatus, "HIDDEN");
});

test("paylaşımı geri açmak görünürlüğü/süreyi değiştirmez; silinmiş içerik geri getirilemez", async () => {
  const row = await poll("FRIENDS"); const reported = await report("POLL", row.id); await review(reported.id, "HIDE_POLL");
  const current = await db.poll.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal((await http("PUT", `/admin/polls/${row.id}/visibility`, actors[0], { contentStatus: "VISIBLE", expectedVersion: row.version, reason: "İtiraz kabul" })).body.error.code, "VERSION_CONFLICT");
  await ok("PUT", `/admin/polls/${row.id}/visibility`, actors[0], { contentStatus: "VISIBLE", expectedVersion: current.version, reason: "İtiraz kabul" });
  const restored = await db.poll.findUniqueOrThrow({ where: { id: row.id } }); assert.equal(restored.visibility, "FRIENDS"); assert.deepEqual(restored.closesAt, row.closesAt);
  assert.equal((await http("GET", `/polls/${row.id}`, actors[2])).status, 200); assert.equal((await http("GET", `/polls/${row.id}`, actors[3])).status, 404);
  await db.poll.update({ where: { id: row.id }, data: { contentStatus: "REMOVED" } });
  assert.equal((await http("PUT", `/admin/polls/${row.id}/visibility`, actors[0], { contentStatus: "VISIBLE", expectedVersion: restored.version, reason: "Geri aç" })).body.error.code, "CONTENT_REMOVED");
});

test("yanlış hedefe yaptırım veya eski sürüm karar/denetim kaydı oluşturmaz", async () => {
  const reported = await report("USER", actors[1].id);
  assert.equal((await review(reported.id, "HIDE_POLL")).body.error.code, "REPORT_ACTION_MISMATCH");
  assert.equal((await db.report.findUniqueOrThrow({ where: { id: reported.id } })).status, "OPEN");
  assert.equal(await db.moderationAudit.count({ where: { reportId: reported.id } }), 0);
  assert.equal((await review(reported.id, "NO_ACTION")).status, 200);
});

test("iki yönetici aynı şikâyete eşzamanlı karar verirse tek karar ve audit oluşur", async () => {
  const reported = await report("USER", actors[1].id); await db.user.update({ where: { id: actors[3].id }, data: { role: "ADMIN" } });
  const result = await Promise.all([review(reported.id, "DISMISS"), review(reported.id, "NO_ACTION", randomUUID(), actors[3])]);
  assert.deepEqual(result.map((row) => row.status).sort(), [200, 409]); assert.equal(await db.moderationAudit.count({ where: { reportId: reported.id } }), 1);
});

test("yorum yaptırımı yazıyı kaldırır, kaldıran/tarih korunur ve içerik audite kopyalanmaz", async () => {
  const row = await poll(); const comment = await db.comment.create({ data: { pollId: row.id, authorId: actors[3].id, body: "Gizli yorum içeriği" } });
  const reported = await report("COMMENT", comment.id); assert.equal((await review(reported.id, "REMOVE_COMMENT")).status, 200);
  const removed = await db.comment.findUniqueOrThrow({ where: { id: comment.id } }); assert.equal(removed.contentStatus, "REMOVED"); assert.equal(removed.removedById, actors[0].id);
  assert.equal((await ok("GET", `/polls/${row.id}/comments`, actors[2])).items.length, 0);
  await ok("POST", `/admin/comments/${comment.id}/remove`, actors[0], { reason: "Tekrar kontrol" });
  assert.deepEqual((await db.comment.findUniqueOrThrow({ where: { id: comment.id } })).removedAt, removed.removedAt);
  assert.equal(JSON.stringify(await ok("GET", "/admin/audit")).includes(comment.body), false);
});

test("hesap yaptırımı oturum/cihazı kapatır; socket ve özel oyun bildirimi erişimini keser", async () => {
  const row = await game(); const host = await connect(actors[1]); const member = await connect(actors[2]);
  for (const client of [host, member]) assert.equal((await client.timeout(5000).emitWithAck("game.subscribe", { sessionId: row.id })).ok, true);
  await ok("PUT", `/me/devices/${randomUUID()}`, actors[1], { platform: "ios", token: `local-${randomUUID()}` });
  await db.notification.create({ data: { userId: actors[2].id, eventId: randomUUID(), type: "game.voting.opened", resourceType: "game", resourceId: row.id } });
  assert.equal((await ok("GET", "/me/notifications", actors[2])).items[0].target.title, "Gizli tema");
  const disconnected = event(host, "disconnect"); const revoked = event(member, "game.access-revoked");
  const reported = await report("USER", actors[1].id); assert.equal((await review(reported.id, "SUSPEND_USER")).status, 200);
  await app.get(OutboxDispatcher).drain(); await disconnected; assert.deepEqual(await revoked, { sessionId: row.id });
  assert.equal((await http("GET", "/auth/me", actors[1])).status, 401);
  assert.equal(await db.deviceToken.count({ where: { userId: actors[1].id } }), 0);
  assert.equal((await ok("GET", "/me/notifications", actors[2])).items[0].target.title, null);
  assert.equal((await http("GET", `/users/${actors[1].id}`, actors[2])).status, 404);
});

test("hesabı geri açmak eski oturumu canlandırmaz; yönetici ve silinmiş hesap korunur", async () => {
  const body = { reason: "İnceleme gerekçesi", status: "SUSPENDED" };
  assert.equal((await http("PUT", `/admin/users/${actors[0].id}/status`, actors[0], body)).body.error.code, "PROTECTED_ADMIN");
  await db.user.update({ where: { id: actors[3].id }, data: { role: "ADMIN" } });
  assert.equal((await http("PUT", `/admin/users/${actors[3].id}/status`, actors[0], body)).body.error.code, "PROTECTED_ADMIN");
  await ok("PUT", `/admin/users/${actors[1].id}/status`, actors[0], body);
  await ok("PUT", `/admin/users/${actors[1].id}/status`, actors[0], { reason: "İtiraz kabul", status: "ACTIVE" });
  assert.equal((await http("GET", "/auth/me", actors[1])).status, 401);
  const fresh = await ok("POST", "/auth/mock", actors[1], { provider: "google", subject: actors[1].subject, acknowledgeMock: true });
  assert.equal((await http("GET", "/auth/me", { ...actors[1], token: fresh.accessToken })).status, 200);
  await db.user.update({ where: { id: actors[1].id }, data: { status: "DELETED" } });
  assert.equal((await http("PUT", `/admin/users/${actors[1].id}/status`, actors[0], { reason: "Geri aç", status: "ACTIVE" })).body.error.code, "ACCOUNT_DELETED");
});

test("yönetici oyunu sürümle iptal eder, davet kapanır ve canlı üye iptali okur", async () => {
  const row = await game(); const client = await connect(actors[2]); await client.timeout(5000).emitWithAck("game.subscribe", { sessionId: row.id });
  await app.get(OutboxDispatcher).drain(); const state = await ok("GET", `/games/${row.id}`, actors[1]); const changed = event(client, "game.changed");
  const result = await ok("POST", `/admin/games/${row.id}/cancel`, actors[0], { expectedVersion: state.version, reason: "Oyun incelemesi" });
  await app.get(OutboxDispatcher).drain(); assert.equal((await changed).sessionId, row.id);
  assert.equal((await ok("GET", `/games/${row.id}`, actors[2])).cancelReason, "MODERATION");
  assert.equal((await db.gameSession.findUniqueOrThrow({ where: { id: row.id } })).inviteHash, null);
  assert.equal((await http("POST", "/games/invites/preview", actors[2], { token: row.token })).status, 404);
  assert.equal((await db.moderationAudit.findUniqueOrThrow({ where: { id: result.auditId } })).action, "GAME_CANCELLED");
  const expired = await game();
  await db.gameSession.update({ where: { id: expired.id }, data: { waitingExpiresAt: new Date(Date.now() - 1000) } });
  const stale = await http("POST", `/admin/games/${expired.id}/cancel`, actors[0], { expectedVersion: expired.version, reason: "Geç kalan iptal" });
  assert.equal(stale.body.error.code, "VERSION_CONFLICT");
  assert.equal(await db.moderationAudit.count({ where: { resourceId: expired.id } }), 0);
  const finished = await ok("GET", `/games/${expired.id}`, actors[1]); assert.equal(finished.cancelReason, "LOBBY_EXPIRED");
  assert.equal((await http("POST", `/admin/games/${expired.id}/cancel`, actors[0], { expectedVersion: finished.version, reason: "Yeniden iptal" })).body.error.code, "GAME_FINISHED");
});

test("denetim kayıtları filtre/sayfalama ile okunur; yetkisi alınan yönetici makbuzu tekrar okuyamaz", async () => {
  const row = await poll(); const key = randomUUID(); const body = { reason: "İnceleme gerekçesi", expectedVersion: row.version, contentStatus: "HIDDEN" };
  const applied = await ok("PUT", `/admin/polls/${row.id}/visibility`, actors[0], body, key);
  await ok("PUT", `/admin/users/${actors[1].id}/status`, actors[0], { reason: "Kural ihlali", status: "SUSPENDED" });
  const page = await ok("GET", "/admin/audit?limit=1"); assert.ok(page.nextCursor);
  assert.equal((await ok("GET", `/admin/audit?limit=1&cursor=${page.nextCursor}`)).items.length, 1);
  assert.equal((await http("GET", `/admin/audit?resourceType=POLL&cursor=${page.nextCursor}`)).body.error.code, "INVALID_CURSOR");
  assert.equal((await ok("GET", `/admin/audit?resourceType=POLL&resourceId=${row.id}`)).items[0].id, applied.auditId);
  await db.user.update({ where: { id: actors[0].id }, data: { role: "USER" } });
  assert.equal((await http("PUT", `/admin/polls/${row.id}/visibility`, actors[0], body, key)).body.error.code, "ADMIN_REQUIRED");
  assert.equal((await http("GET", "/admin/audit")).status, 403);
});

test("audit/outbox hatası karar, yaptırım ve makbuzun tamamını geri alır", async () => {
  const row = await poll(); const reported = await report("POLL", row.id); const name = `test_admin_${randomUUID().replaceAll("-", "")}`;
  await db.$executeRawUnsafe(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type = 'moderation.action.applied' THEN RAISE EXCEPTION 'test rollback'; END IF; RETURN NEW; END; $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER "${name}" BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION "${name}"()`);
  const key = randomUUID();
  try {
    assert.equal((await review(reported.id, "HIDE_POLL", key)).status, 500);
    assert.equal((await db.poll.findUniqueOrThrow({ where: { id: row.id } })).contentStatus, "VISIBLE");
    assert.equal((await db.report.findUniqueOrThrow({ where: { id: reported.id } })).status, "OPEN");
    assert.equal(await db.moderationAudit.count({ where: { reportId: reported.id } }), 0);
    assert.equal(await db.idempotencyRecord.count({ where: { userId: actors[0].id, key } }), 0);
  } finally { await db.$executeRawUnsafe(`DROP TRIGGER "${name}" ON "OutboxEvent"`); await db.$executeRawUnsafe(`DROP FUNCTION "${name}"()`); }
  assert.equal((await review(reported.id, "HIDE_POLL", key)).status, 200);
});

test("DB kısıtları kısmi inceleme ve eksik denetim verisini reddeder; OpenAPI yönetimi belirtir", async () => {
  const reported = await report("USER", actors[1].id);
  await assert.rejects(db.report.update({ where: { id: reported.id }, data: { status: "RESOLVED", reviewedAt: new Date(), reviewedById: actors[0].id } }));
  await assert.rejects(db.report.update({ where: { id: reported.id }, data: { version: -1 } }));
  await assert.rejects(db.moderationAudit.create({ data: { action: "USER_SUSPENDED", resourceType: "USER", resourceId: actors[1].id, reason: "Test", before: {}, after: {} } }));
  await assert.rejects(db.moderationAudit.create({ data: { actorId: actors[0].id, action: "USER_SUSPENDED", resourceType: "USER", resourceId: actors[1].id, reason: "  ", before: {}, after: {} } }));
  const spec = await ok("GET", "/openapi.json");
  for (const path of ["/v1/admin/me", "/v1/admin/reports", "/v1/admin/reports/{id}/decision", "/v1/admin/users/{id}/status", "/v1/admin/audit"]) assert.ok(spec.paths[path], path);
  assert.ok(spec.paths["/v1/admin/reports/{id}/decision"].put.parameters.some((field: any) => field.name === "Idempotency-Key"));
  assert.deepEqual(spec.components.schemas.ReviewReportDto.properties.decision.enum, ["DISMISS", "NO_ACTION", "HIDE_POLL", "REMOVE_COMMENT", "SUSPEND_USER"]);
  assert.equal(spec.components.schemas.AdminReportDetailDto.properties.target.oneOf.length, 3);
  assert.ok(spec.components.schemas.AdminAuditEntryDto.properties.before);
});
