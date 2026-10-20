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
import { readEnvironment } from "../src/common/config/environment.js";
import { dailyGameStart, gameLocalDay } from "../src/modules/games/game-schedule.js";

const load = (path: string) => import(new URL(`../dist/${path}.js`, import.meta.url).href);
const { createApp } = await load("create-app") as { createApp: () => Promise<NestExpressApplication> };
const { PrismaService } = await load("database/prisma.service");
const { GameSchedulerService } = await load("modules/games/game-scheduler.service");
const { GameLifecycleService } = await load("modules/games/game-lifecycle.service");
const { GameWorker } = await load("modules/games/game.worker");
const { MediaService } = await load("modules/media/media.service");
type Actor = { id: string; token: string };
let app: NestExpressApplication; let db: PrismaClient; let base: string; let directory: string;
let actors: Actor[]; let sessions: string[]; let themes: string[];
let dayIndex = 0;
const envKeys = ["NODE_ENV", "AUTH_MOCK_ENABLED", "LOCAL_MEDIA_DIR", "DAILY_GAME_START_TIME", "DAILY_GAME_TIME_ZONE", "DAILY_GAME_THEME_SLUG"] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const png = await sharp({ create: { width: 64, height: 80, channels: 3, background: "#8877aa" } }).png().toBuffer();

async function call(method: string, path: string, actor: Actor | null = actors[0], body?: unknown, key: string | null = randomUUID()) {
  const response = await fetch(`${base}${path}`, { method, headers: {
    ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    ...(key ? { "Idempotency-Key": key } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
  const result = { status: response.status, body: await response.json() as any };
  if (method === "POST" && path === "/games/lobbies" && result.status === 201) sessions.push(result.body.id);
  return result;
}

async function lobby(fields: Record<string, unknown> = {}) {
  const response = await call("POST", "/games/lobbies", actors[0], { themeTitle: "90'lar", submissionSeconds: 60, votingSeconds: 120, ...fields });
  assert.equal(response.status, 201, JSON.stringify(response.body)); return response.body;
}
async function state(id: string, actor = actors[0]) { const result = await call("GET", `/games/${id}`, actor); assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body; }
async function command(id: string, action: string, actor = actors[0], key = randomUUID()) {
  const current = await state(id, actor);
  return call("POST", `/games/${id}/${action}`, actor, { expectedVersion: current.version }, key);
}
async function invite(id: string) { const result = await command(id, "invite"); assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body; }
async function group(count = 3, fields: Record<string, unknown> = {}) {
  const row = await lobby(fields); const grant = await invite(row.id);
  for (let index = 1; index < count; index++) assert.equal((await call("POST", "/games/join", actors[index], { token: grant.token })).status, 200);
  return { id: row.id, grant };
}
async function readyMedia(actor = actors[0], fields: { purpose?: "GAME" | "POLL" | "AVATAR"; approve?: boolean } = {}) {
  const row = await db.mediaAsset.create({ data: { ownerId: actor.id, purpose: fields.purpose ?? "GAME", status: "READY",
    uploadKey: `test-${randomUUID()}`, displayKey: `test-${randomUUID()}`, thumbnailKey: `test-${randomUUID()}`,
    previewAcceptedAt: fields.approve === false ? null : new Date(),
  } }); return row.id;
}
async function submit(id: string, actor = actors[0], mediaId?: string) {
  const photo = mediaId ?? await readyMedia(actor);
  return call("PUT", `/games/${id}/submission`, actor, { mediaId: photo });
}
async function voting() {
  const row = await group(); assert.equal((await command(row.id, "start")).status, 200);
  const first = await submit(row.id); const second = await submit(row.id, actors[1]);
  assert.equal(first.status, 200); assert.equal(second.status, 200);
  const opened = await command(row.id, "end-submission"); assert.equal(opened.body.phase, "VOTING", JSON.stringify(opened));
  return { ...row, first: first.body, second: second.body, opened: opened.body };
}
// Fotoğraf süresi az önce bitmiş gibi kurar; entireWindow ise oylama penceresi de tamamen geçmiştir.
// Turlar planlanan oylama başlangıcından sayıldığı için açık oylama için başlangıç yakın olmalı.
async function elapsed(id: string, entireWindow = false) {
  const now = Date.now();
  const votingStartsAt = new Date(entireWindow ? now - 120000 : now - 1000);
  await db.gameSession.update({ where: { id }, data: { startsAt: new Date(now - 180000), submissionEndsAt: votingStartsAt,
    votingStartsAt, votingEndsAt: new Date(entireWindow ? now - 1000 : now + 120000) } });
}
async function upload(actor = actors[0]) {
  const grant = await call("POST", "/media/uploads", actor, { purpose: "GAME", mimeType: "image/png", byteSize: png.length, blurRequested: false });
  assert.equal(grant.status, 201, JSON.stringify(grant.body));
  const form = new FormData(); form.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "outfit.png");
  const response = await fetch(`${base.replace(/\/v1$/, "")}${grant.body.upload.path}`, { method: "POST", headers: { Authorization: `Bearer ${actor.token}`, "X-Upload-Token": grant.body.upload.token }, body: form });
  await response.arrayBuffer(); assert.equal(response.status, 200);
  const id = grant.body.asset.id;
  assert.equal((await call("POST", `/media/${id}/complete`, actor, {})).status, 200);
  assert.equal((await call("POST", `/media/${id}/accept-preview`, actor, { confirmed: true })).status, 200);
  return id as string;
}
async function image(id: string, actor: Actor) {
  const response = await fetch(`${base}/media/${id}/content`, { headers: { Authorization: `Bearer ${actor.token}` } });
  const bytes = await response.arrayBuffer(); return { status: response.status, bytes: bytes.byteLength };
}
async function daily() {
  const theme = await db.theme.create({ data: { slug: `test-${randomUUID()}`, title: "Günlük tema" } }); themes.push(theme.id);
  const day = `2099-04-${String(++dayIndex).padStart(2, "0")}`;
  const schedule = { startTime: "20:00", timeZone: "Europe/Istanbul", themeSlug: theme.slug };
  const row = await app.get(GameSchedulerService).ensureDaily(day, schedule); sessions.push(row.id);
  return { row, theme, schedule, day };
}

beforeEach(async () => {
  process.env.NODE_ENV = "test"; process.env.AUTH_MOCK_ENABLED = "true";
  delete process.env.DAILY_GAME_START_TIME; delete process.env.DAILY_GAME_TIME_ZONE; delete process.env.DAILY_GAME_THEME_SLUG;
  directory = await mkdtemp(join(tmpdir(), "podyum-games-")); process.env.LOCAL_MEDIA_DIR = directory;
  actors = []; sessions = []; themes = [];
  app = await createApp(); await app.listen(0, "127.0.0.1"); base = `${await app.getUrl()}/v1`; db = app.get(PrismaService);
  for (let index = 0; index < 4; index++) {
    const session = await call("POST", "/auth/mock", null, { provider: "google", subject: `games_${randomUUID()}`, acknowledgeMock: true });
    assert.equal(session.status, 200); const actor = { id: "", token: session.body.accessToken };
    actor.id = (await call("GET", "/auth/me", actor)).body.user.id; actors.push(actor);
  }
});
afterEach(async () => {
  try {
    const users = actors.map((actor) => actor.id);
    await db.$transaction(async (tx) => {
      await tx.outboxEvent.deleteMany({ where: { aggregateId: { in: [...sessions, ...users] } } });
      await tx.idempotencyRecord.deleteMany({ where: { userId: { in: users } } });
      await tx.gameLeaguePoint.deleteMany({ where: { sessionId: { in: sessions } } });
      await tx.gameOutcome.deleteMany({ where: { sessionId: { in: sessions } } });
      await tx.gameScore.deleteMany({ where: { sessionId: { in: sessions } } });
      await tx.gameSubmission.deleteMany({ where: { sessionId: { in: sessions } } });
      await tx.gameMembership.deleteMany({ where: { sessionId: { in: sessions } } });
      await tx.gameSession.deleteMany({ where: { id: { in: sessions } } });
      await tx.mediaAsset.deleteMany({ where: { ownerId: { in: users } } });
      await tx.theme.deleteMany({ where: { id: { in: themes } } });
      await tx.block.deleteMany({ where: { OR: [{ blockerId: { in: users } }, { blockedId: { in: users } }] } });
      await tx.friendship.deleteMany({ where: { OR: [{ userAId: { in: users } }, { userBId: { in: users } }] } });
      await tx.usedRefreshToken.deleteMany({ where: { session: { userId: { in: users } } } });
      await tx.authSession.deleteMany({ where: { userId: { in: users } } });
      await tx.authIdentity.deleteMany({ where: { userId: { in: users } } });
      await tx.user.deleteMany({ where: { id: { in: users } } });
    });
  } finally {
    await app?.close(); await rm(directory, { recursive: true, force: true });
    for (const key of envKeys) { if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key]; }
  }
});

test("oyun uçları oturum, işlem anahtarı, UUID ve katı DTO ister", async () => {
  assert.equal((await call("GET", "/games/daily", null)).status, 401);
  assert.equal((await call("POST", "/games/lobbies", null, { themeTitle: "Test" })).status, 401);
  assert.equal((await call("POST", "/games/lobbies", actors[0], { themeTitle: "Test" }, null)).body.error.code, "IDEMPOTENCY_KEY_REQUIRED");
  for (const body of [{ themeTitle: "" }, { themeTitle: "x", submissionSeconds: 59 }, { themeTitle: "x", votingSeconds: 7201 }, { themeTitle: "x", maxMembers: 51 }, { themeTitle: "x", maxMembers: 1 }, { themeTitle: "x", hostId: actors[1].id }, { themeTitle: "x", kind: "DAILY" }, { themeTitle: "x", submissionSeconds: "60" }]) {
    assert.equal((await call("POST", "/games/lobbies", actors[0], body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await call("GET", "/games/bad")).status, 400);
  assert.equal((await call("POST", "/games/join", actors[1], { token: "fake" })).status, 400);
  assert.equal((await call("POST", "/games/join", actors[1], { token: "a".repeat(43), userId: actors[0].id })).status, 400);
  const row = await lobby();
  assert.equal((await call("POST", `/games/${row.id}/leave`, actors[0], { userId: actors[1].id })).status, 400);
  assert.equal((await call("GET", `/games/${row.id}/ballot?limit=51`)).status, 400);
});

test("özel lobi oluşturma atomik/idempotent; host üye, QR token'ı state'e sızmaz", async () => {
  const key = randomUUID(); const body = { themeTitle: "Minimal", maxMembers: 2 };
  const first = await call("POST", "/games/lobbies", actors[0], body, key);
  assert.equal(first.status, 201); assert.equal(first.body.phase, "WAITING"); assert.equal(first.body.memberCount, 1); assert.equal(first.body.isHost, true);
  assert.deepEqual((await call("POST", "/games/lobbies", actors[0], body, key)).body, first.body);
  assert.equal((await call("POST", "/games/lobbies", actors[0], { ...body, themeTitle: "Farklı" }, key)).body.error.code, "IDEMPOTENCY_KEY_REUSED");
  for (const field of ["inviteHash", "token", "inviteCodeHash"]) assert.equal(field in first.body, false);
  assert.equal(await db.gameSession.count({ where: { hostId: actors[0].id } }), 1);
});

test("QR yalnız davettir; hash saklanır, yenileme/iptal/süre bitişi eski daveti kapatır", async () => {
  const row = await lobby(); const first = await invite(row.id);
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/); assert.match(first.deepLink, /^podyum:\/\/games\/join\?token=/);
  assert.equal((await call("POST", "/games/invites/preview", actors[1], { token: first.token })).status, 200);
  assert.equal((await call("GET", `/games/${row.id}`, actors[1])).status, 404);
  assert.equal(await db.gameMembership.count({ where: { sessionId: row.id } }), 1);
  assert.notEqual((await db.gameSession.findUniqueOrThrow({ where: { id: row.id } })).inviteHash, first.token);
  assert.ok(!JSON.stringify(await db.outboxEvent.findMany({ where: { aggregateId: row.id } })).includes(first.token));
  assert.ok(!JSON.stringify(await db.idempotencyRecord.findMany({ where: { userId: actors[0].id } })).includes(first.token));
  const second = await invite(row.id);
  assert.equal((await call("POST", "/games/invites/preview", actors[1], { token: first.token })).status, 404);
  assert.equal((await command(row.id, "invite/revoke")).status, 200);
  assert.equal((await call("POST", "/games/join", actors[1], { token: second.token })).status, 404);
  const third = await invite(row.id); await db.gameSession.update({ where: { id: row.id }, data: { inviteExpiresAt: new Date(Date.now() - 1) } });
  assert.equal((await call("POST", "/games/invites/preview", actors[1], { token: third.token })).status, 404);
});

test("QR ve giriş özel katılıma yeter; oda kimliğiyle davet atlanamaz, kapasite yarışında aşılmaz", async () => {
  const row = await lobby({ maxMembers: 2 }); const grant = await invite(row.id);
  assert.equal(await db.friendship.count({ where: { OR: [{ userAId: actors[0].id }, { userBId: actors[0].id }] } }), 0);
  assert.equal((await call("POST", `/games/${row.id}/join`, actors[1], {})).status, 404);
  const responses = await Promise.all([1, 2].map((index) => call("POST", "/games/join", actors[index], { token: grant.token })));
  assert.deepEqual(responses.map((result) => result.status).sort(), [200, 409]);
  const winner = actors[responses[0].status === 200 ? 1 : 2];
  assert.equal((await call("POST", "/games/join", winner, { token: grant.token })).status, 200);
  assert.equal((await state(row.id)).memberCount, 2);
});

test("host veya mevcut üyeyle iki yönlü engel davetle aşılamaz", async () => {
  const row = await group(2);
  await call("PUT", `/blocks/${actors[2].id}`, actors[0]);
  assert.equal((await call("POST", "/games/join", actors[2], { token: row.grant.token })).status, 404);
  await call("PUT", `/blocks/${actors[3].id}`, actors[1]);
  assert.equal((await call("POST", "/games/join", actors[3], { token: row.grant.token })).body.error.code, "GAME_ACCESS_DENIED");
  await call("PUT", `/blocks/${actors[0].id}`, actors[1]);
  assert.equal((await call("GET", `/games/${row.id}`, actors[1])).status, 404);
});

test("ayar/başlatma host ve güncel sürüm ister; başlamış oyunun tema/süreleri değişmez", async () => {
  const solo = await lobby(); assert.equal((await command(solo.id, "start")).body.error.code, "NOT_ENOUGH_PLAYERS");
  const row = await group(); const current = await state(row.id);
  assert.equal((await call("POST", `/games/${row.id}/start`, actors[1], { expectedVersion: current.version })).status, 403);
  assert.equal((await call("POST", `/games/${row.id}/start`, actors[0], { expectedVersion: current.version - 1 })).body.error.code, "VERSION_CONFLICT");
  assert.equal((await call("PUT", `/games/${row.id}/settings`, actors[0], { themeTitle: "Yeni", maxMembers: 2, expectedVersion: current.version })).body.error.code, "CAPACITY_BELOW_MEMBERS");
  assert.equal((await call("PUT", `/games/${row.id}/settings`, actors[0], { themeTitle: "Yeni", submissionSeconds: 90, votingSeconds: 180, expectedVersion: current.version })).status, 200);
  const started = await command(row.id, "start"); assert.equal(started.status, 200);
  assert.equal(new Date(started.body.submissionEndsAt).getTime() - new Date(started.body.startsAt).getTime(), 90000);
  assert.equal((await call("PUT", `/games/${row.id}/settings`, actors[0], { themeTitle: "Başka", expectedVersion: started.body.version })).body.error.code, "GAME_ALREADY_STARTED");
});

test("teslim kendi onaylı GAME fotoğrafı ister; aynı tekrar tek makbuz, süre içinde değiştirme tek entry", async () => {
  const row = await group(); const photo = await readyMedia();
  assert.equal((await submit(row.id, actors[0], photo)).body.error.code, "SUBMISSION_CLOSED");
  await command(row.id, "start");
  assert.equal((await submit(row.id, actors[3])).status, 404);
  assert.equal((await submit(row.id, actors[0], await readyMedia(actors[1]))).status, 404);
  assert.equal((await submit(row.id, actors[0], await readyMedia(actors[0], { purpose: "POLL" }))).body.error.code, "MEDIA_PURPOSE_MISMATCH");
  assert.equal((await submit(row.id, actors[0], await readyMedia(actors[0], { approve: false }))).body.error.code, "MEDIA_NOT_APPROVED");
  const first = await submit(row.id, actors[0], photo); assert.equal(first.status, 200);
  assert.deepEqual((await submit(row.id, actors[0], photo)).body, first.body);
  const replaced = await submit(row.id); assert.equal(replaced.body.submissionId, first.body.submissionId); assert.notEqual(replaced.body.mediaId, photo);
  assert.equal(await db.gameSubmission.count({ where: { sessionId: row.id, userId: actors[0].id } }), 1);
  assert.equal((await call("DELETE", `/media/${photo}`)).status, 200);
});

test("gerçek GAME fotoğrafı oylama öncesi sadece sahibine, oylamada sadece üyelere açılır; cleanup kullanımda medyayı korur", async () => {
  const row = await group(); await command(row.id, "start");
  const photo = await upload(); const first = await submit(row.id, actors[0], photo); assert.equal(first.status, 200);
  await submit(row.id, actors[1]);
  assert.equal((await image(photo, actors[0])).status, 200); assert.equal((await image(photo, actors[1])).status, 404);
  await command(row.id, "end-submission");
  const shown = await image(photo, actors[2]); assert.equal(shown.status, 200); assert.ok(shown.bytes > 0);
  assert.equal((await image(photo, actors[3])).status, 404);
  assert.equal((await call("GET", `/media/${photo}`, actors[1])).status, 404);
  assert.equal((await call("DELETE", `/media/${photo}`)).body.error.code, "MEDIA_IN_USE");
  await db.mediaAsset.update({ where: { id: photo }, data: { createdAt: new Date(Date.now() - 864000000) } });
  await app.get(MediaService).cleanup();
  assert.equal((await db.mediaAsset.findUniqueOrThrow({ where: { id: photo } })).status, "READY");
});

test("erken bitiş oylama süresini DB saatinden başlatır; tekrar süreyi/sürümü yeniden başlatmaz", async () => {
  const row = await group(); await command(row.id, "start"); await submit(row.id); await submit(row.id, actors[1]);
  const current = await state(row.id); const key = randomUUID(); const body = { expectedVersion: current.version };
  assert.equal((await call("POST", `/games/${row.id}/end-submission`, actors[1], body)).status, 403);
  const opened = await call("POST", `/games/${row.id}/end-submission`, actors[0], body, key);
  assert.equal(opened.body.phase, "VOTING"); assert.equal(new Date(opened.body.votingEndsAt).getTime() - new Date(opened.body.votingStartsAt).getTime(), 120 * 1000, "Özel lobinin seçilen oy süresi korunur.");
  assert.deepEqual((await call("POST", `/games/${row.id}/end-submission`, actors[0], body, key)).body, opened.body);
  assert.equal((await command(row.id, "end-submission")).body.error.code, "SUBMISSION_CLOSED");
  assert.equal((await submit(row.id)).body.error.code, "SUBMISSION_CLOSED");
  assert.equal((await call("POST", "/games/join", actors[3], { token: row.grant.token })).status, 404);
});

test("iki geçerli teslim yoksa gerekçeli iptal; bekleyen host ayrılırsa lobi kapanır", async () => {
  const row = await group(); await command(row.id, "start"); await submit(row.id);
  const cancelled = await command(row.id, "end-submission"); assert.equal(cancelled.body.phase, "CANCELLED"); assert.equal(cancelled.body.cancelReason, "NOT_ENOUGH_SUBMISSIONS");
  const waiting = await lobby(); const left = await call("POST", `/games/${waiting.id}/leave`, actors[0], {});
  assert.equal(left.status, 200); assert.equal(left.body.phase, "CANCELLED");
  assert.equal((await db.gameSession.findUniqueOrThrow({ where: { id: waiting.id } })).cancelReason, "HOST_LEFT");
  const stale = await lobby(); await db.gameSession.update({ where: { id: stale.id }, data: { waitingExpiresAt: new Date(Date.now() - 1) } });
  await app.get(GameLifecycleService).scan();
  assert.equal((await state(stale.id)).cancelReason, "LOBBY_EXPIRED");
});

test("günlük takvim tekilleşir; tema/saat snapshot'ı ve sabit 30+30 korunur", async () => {
  const f = await daily();
  const copies = await Promise.all([app.get(GameSchedulerService).ensureDaily(f.day, f.schedule), app.get(GameSchedulerService).ensureDaily(f.day, { ...f.schedule, startTime: "21:00" })]);
  assert.ok(copies.every((row: any) => row.id === f.row.id));
  assert.equal(await db.gameSession.count({ where: { dailyKey: f.day } }), 1);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: f.row.id, type: "game.created" } }), 1);
  await db.theme.update({ where: { id: f.theme.id }, data: { title: "Değişti" } });
  const saved = await db.gameSession.findUniqueOrThrow({ where: { id: f.row.id } });
  assert.equal(saved.themeTitle, "Günlük tema"); assert.equal(saved.submissionSeconds, 1800); assert.equal(saved.votingSeconds, 1800);
  assert.equal(saved.submissionEndsAt!.getTime() - saved.startsAt!.getTime(), 1800000);
  assert.equal(saved.votingEndsAt!.getTime() - saved.submissionEndsAt!.getTime(), 1800000);
});

test("günlük etkinlikte fotoğrafsız üye oy verir; dış kullanıcı veremez, kendi oyuna yıldız ve temaya uygunluk alanı yok", async () => {
  const f = await daily(); const id = f.row.id;
  for (const actor of actors.slice(0, 3)) assert.equal((await call("POST", `/games/${id}/join`, actor, {})).status, 200);
  const now = Date.now(); await db.gameSession.update({ where: { id }, data: { phase: "SUBMISSION", startsAt: new Date(now - 1000),
    submissionEndsAt: new Date(now + 1800000), votingStartsAt: new Date(now + 1800000), votingEndsAt: new Date(now + 3600000) } });
  const first = await submit(id); await submit(id, actors[1]);
  await elapsed(id); assert.equal((await state(id, actors[2])).phase, "VOTING");
  assert.equal((await state(id, actors[2])).mySubmission, null); assert.equal((await state(id, actors[2])).canVote, true);
  const path = `/games/${id}/submissions/${first.body.submissionId}/rating`;
  assert.equal((await call("PUT", path, actors[3], { stars: 5 })).status, 404);
  assert.equal((await call("PUT", path, actors[0], { stars: 5 })).body.error.code, "SELF_RATING_NOT_ALLOWED");
  assert.equal((await call("PUT", path, actors[2], { stars: 5, themeFits: true })).status, 400);
  for (const stars of [0, 6, 2.5, "5", null]) assert.equal((await call("PUT", path, actors[2], { stars })).status, 400);
  assert.equal((await call("PUT", path, actors[2], { stars: 5 })).status, 200);
  assert.equal((await call("POST", `/games/${id}/join`, actors[3], {})).body.error.code, "GAME_JOIN_CLOSED");
  assert.equal(await db.pointsLedger.count({ where: { userId: { in: actors.map((actor) => actor.id) } } }), 0);
});

test("değerlendirme aynı tekrarda aynı makbuz; değiştirme/başka oda reddedilir, oy verilen kart çıkar", async () => {
  const row = await voting(); const other = await voting();
  const path = `/games/${row.id}/submissions/${row.first.submissionId}/rating`;
  const first = await call("PUT", path, actors[2], { stars: 4 }); assert.equal(first.status, 200);
  assert.deepEqual((await call("PUT", path, actors[2], { stars: 4 })).body, first.body);
  assert.equal((await call("PUT", path, actors[2], { stars: 2 })).body.error.code, "RATING_ALREADY_CAST");
  assert.equal((await call("PUT", `/games/${row.id}/submissions/${other.first.submissionId}/rating`, actors[2], { stars: 4 })).status, 404);
  assert.ok(!(await call("GET", `/games/${row.id}/ballot`, actors[2])).body.items.some((card: any) => card.id === row.first.submissionId));
  assert.equal(await db.gameScore.count({ where: { sessionId: row.id } }), 1);
  await elapsed(row.id, true); assert.deepEqual((await call("PUT", path, actors[2], { stars: 4 })).body, first.body);
  assert.equal((await state(row.id)).phase, "COMPLETED");
});

test("anonim oy kartları döndürülen sırayla sayfalanır; cursor kaynak/oda/kullanıcıya bağlı", async () => {
  const row = await group(4); await command(row.id, "start");
  const entries: string[] = [];
  for (const actor of actors.slice(0, 3)) entries.push((await submit(row.id, actor)).body.submissionId);
  await command(row.id, "end-submission");
  const first = await call("GET", `/games/${row.id}/ballot?limit=1`, actors[3]); assert.equal(first.status, 200); assert.ok(first.body.nextCursor);
  const second = await call("GET", `/games/${row.id}/ballot?limit=2&cursor=${first.body.nextCursor}`, actors[3]);
  assert.deepEqual(new Set([...first.body.items, ...second.body.items].map((card: any) => card.id)), new Set(entries));
  assert.equal(second.body.nextCursor, null);
  for (const card of [...first.body.items, ...second.body.items]) assert.deepEqual(Object.keys(card).sort(), ["displayPath", "id", "mediaId", "number", "thumbnailPath"]);
  assert.equal((await call("GET", `/games/${row.id}/ballot?cursor=${first.body.nextCursor}`, actors[2])).body.error.code, "INVALID_CURSOR");
  assert.equal((await call("GET", `/games/${row.id}/results?cursor=${first.body.nextCursor}`, actors[3])).body.error.code, "INVALID_CURSOR");
  const own = await call("GET", `/games/${row.id}/ballot`, actors[0]); assert.ok(!own.body.items.some((card: any) => card.id === entries[0]));
});

test("sonuçlar kapanışa kadar kapalı; sıfır oy null, ortalama/kimlik sonra açılır, profil puanı yok", async () => {
  const row = await voting();
  assert.equal((await call("GET", `/games/${row.id}/results`, actors[0])).body.error.code, "RESULTS_NOT_AVAILABLE");
  await call("PUT", `/games/${row.id}/submissions/${row.first.submissionId}/rating`, actors[2], { stars: 5 });
  await elapsed(row.id, true);
  const result = await call("GET", `/games/${row.id}/results?limit=1`, actors[2]); assert.equal(result.status, 200);
  const first = result.body.items[0]; assert.equal(first.author.id, actors[0].id); assert.equal(first.averageStars, 5); assert.equal(first.ratingCount, 1);
  assert.equal(result.body.official, false); assert.equal(result.body.awardedPoints, 0); assert.ok(result.body.nextCursor);
  const next = await call("GET", `/games/${row.id}/results?cursor=${result.body.nextCursor}`, actors[2]);
  assert.equal(next.body.items[0].averageStars, null); assert.equal(next.body.items[0].ratingCount, 0);
  assert.equal((await call("GET", `/games/${row.id}/results`, actors[3])).status, 404);
  assert.equal(await db.pointsLedger.count({ where: { userId: actors[0].id } }), 0);
});

test("geç çalışan işçi kaçan fotoğraf/oy penceresini uzatmaz; sonuç ve olaylar tekilleşir", async () => {
  const row = await group(); await command(row.id, "start"); await submit(row.id); await submit(row.id, actors[1]); await elapsed(row.id, true);
  const before = await db.gameSession.findUniqueOrThrow({ where: { id: row.id } });
  const lifecycle = app.get(GameLifecycleService);
  await Promise.all([lifecycle.scan(), lifecycle.scan()]);
  const saved = await db.gameSession.findUniqueOrThrow({ where: { id: row.id } });
  // Turlar planlanan oylama başlangıcından sayılır; geç işçi pencereyi uzatmaz.
  const turnsEnd = before.votingStartsAt!.getTime() + before.votingSeconds * 1000;
  assert.equal(saved.phase, "COMPLETED"); assert.equal(saved.votingEndsAt!.getTime(), turnsEnd); assert.equal(saved.finishedAt!.getTime(), turnsEnd);
  assert.equal(await db.gameOutcome.count({ where: { sessionId: row.id } }), 2);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: row.id, type: "game.completed" } }), 1);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: row.id, type: "game.voting.opened" } }), 1);
  assert.equal((await lifecycle.scan()).advanced, 0);
  assert.ok((await call("GET", `/games/${row.id}/results`, actors[2])).body.items.every((item: any) => item.averageStars === null));
});

test("fotoğraf teslimi ve erken geçiş yarışında kapanış sonrası teslim eklenmez", async () => {
  const row = await group(); await command(row.id, "start"); await submit(row.id); await submit(row.id, actors[1]);
  const photo = await readyMedia(actors[2]); const current = await state(row.id);
  const [end, delivery] = await Promise.all([
    call("POST", `/games/${row.id}/end-submission`, actors[0], { expectedVersion: current.version }), submit(row.id, actors[2], photo),
  ]);
  assert.ok([200, 409].includes(end.status)); assert.ok([200, 409].includes(delivery.status));
  if (end.status === 409) assert.equal((await command(row.id, "end-submission")).status, 200);
  assert.equal((await state(row.id)).phase, "VOTING");
  assert.equal(await db.gameSubmission.count({ where: { sessionId: row.id, status: "SUBMITTED" } }), 0);
  assert.equal(await db.gameSubmission.count({ where: { sessionId: row.id, status: "FROZEN" } }), delivery.status === 200 ? 3 : 2);
});

test("son süre geçince işçi beklemeden yeni oy reddedilir; kabul edilmeyen oy sonuca yazılmaz", async () => {
  const row = await voting(); await elapsed(row.id, true);
  const late = await call("PUT", `/games/${row.id}/submissions/${row.first.submissionId}/rating`, actors[2], { stars: 5 });
  assert.equal(late.body.error.code, "VOTING_CLOSED");
  const result = await call("GET", `/games/${row.id}/results`, actors[2]); assert.equal(result.status, 200);
  assert.equal(result.body.items[0].ratingCount, 0); assert.equal(await db.gameScore.count({ where: { sessionId: row.id } }), 0);
});

test("oy/sonuç olayı hata verirse tamamı geri alınır; işçi hata sonrası tekrar çalışır", async () => {
  const row = await voting(); const version = (await state(row.id)).version;
  const transaction = db.$transaction.bind(db) as any; const eventCreate = db.outboxEvent.create.bind(db.outboxEvent);
  (db as any).$transaction = (work: any, options: any) => transaction(async (tx: any) => { tx.outboxEvent.create = async () => { throw new Error("test game event failure"); }; return work(tx); }, options);
  try { assert.equal((await call("PUT", `/games/${row.id}/submissions/${row.first.submissionId}/rating`, actors[2], { stars: 5 })).status, 500); }
  finally { (db as any).$transaction = transaction; db.outboxEvent.create = eventCreate as typeof db.outboxEvent.create; }
  assert.equal(await db.gameScore.count({ where: { sessionId: row.id } }), 0); assert.equal((await state(row.id)).version, version);
  await elapsed(row.id, true);
  (db as any).$transaction = (work: any, options: any) => transaction(async (tx: any) => { tx.outboxEvent.create = async () => { throw new Error("test outcome event failure"); }; return work(tx); }, options);
  try { await assert.rejects(app.get(GameLifecycleService).scan()); }
  finally { (db as any).$transaction = transaction; db.outboxEvent.create = eventCreate as typeof db.outboxEvent.create; }
  assert.equal(await db.gameOutcome.count({ where: { sessionId: row.id } }), 0);
  assert.equal((await db.gameSession.findUniqueOrThrow({ where: { id: row.id } })).phase, "VOTING");
  const lifecycle = app.get(GameLifecycleService); const original = lifecycle.scan.bind(lifecycle); let calls = 0;
  let release!: () => void;
  lifecycle.scan = async () => { calls++; await new Promise<void>((resolve) => { release = resolve; }); throw new Error("temporary game outage"); };
  const worker = app.get(GameWorker); const firstTick = worker.tick(); const secondTick = worker.tick();
  // ensureToday ilk await'tir; fake taramaya ulaşınca iki tick aynı promise'i paylaşır.
  while (!release) await new Promise<void>((resolve) => setTimeout(resolve, 1));
  release(); await Promise.all([firstTick, secondTick]); assert.equal(calls, 1); lifecycle.scan = original;
  await app.get(GameWorker).tick(); assert.equal((await state(row.id)).phase, "COMPLETED");
});

test("başladıktan sonra host ayrılması süreyi durdurmaz; ayrılan teslim çıkar ve tekrar giriş yeniden fotoğraf ister", async () => {
  const row = await group(); await command(row.id, "start");
  await submit(row.id); await submit(row.id, actors[1]); await submit(row.id, actors[2]);
  assert.equal((await call("POST", `/games/${row.id}/leave`, actors[1], {})).status, 200);
  assert.equal((await call("POST", "/games/join", actors[1], { token: row.grant.token })).body.mySubmission.status, "WITHDRAWN");
  assert.equal((await submit(row.id, actors[1])).status, 200);
  assert.equal((await call("POST", `/games/${row.id}/leave`, actors[0], {})).status, 200);
  assert.equal((await call("GET", `/games/${row.id}`, actors[0])).status, 404);
  await elapsed(row.id); assert.equal((await state(row.id, actors[1])).phase, "VOTING");
  assert.equal(await db.gameSubmission.count({ where: { sessionId: row.id, status: "FROZEN" } }), 2);
  assert.equal((await call("POST", `/games/${row.id}/leave`, actors[1], {})).body.error.code, "GAME_LEAVE_CLOSED");
});

test("güncel engel ballot/medya/oy/sonuçtan hedefi kapatır", async () => {
  const row = await voting();
  await call("PUT", `/blocks/${actors[1].id}`, actors[2]);
  const ballot = await call("GET", `/games/${row.id}/ballot`, actors[2]);
  assert.ok(!ballot.body.items.some((card: any) => card.id === row.second.submissionId));
  assert.equal((await image(row.second.mediaId, actors[2])).status, 404);
  assert.equal((await call("PUT", `/games/${row.id}/submissions/${row.second.submissionId}/rating`, actors[2], { stars: 3 })).status, 404);
  await elapsed(row.id, true);
  assert.ok(!(await call("GET", `/games/${row.id}/results`, actors[2])).body.items.some((item: any) => item.id === row.second.submissionId));
});

test("oyun geçmişi kişiye özel sayfalanır; eski tek aktif oyun tablosu yeni katılımı kısıtlamaz", async () => {
  const first = await lobby(); const second = await lobby();
  assert.equal((await call("POST", `/games/${first.id}/leave`, actors[0], {})).status, 200);
  const response = await call("GET", "/me/games?limit=1"); assert.equal(response.status, 200); assert.equal(response.body.items[0].id, second.id); assert.ok(response.body.nextCursor);
  const next = await call("GET", `/me/games?cursor=${response.body.nextCursor}`); assert.equal(next.body.items[0].id, first.id); assert.equal(next.body.items[0].membershipStatus, "LEFT");
  assert.equal((await call("GET", `/me/games?cursor=${response.body.nextCursor}`, actors[1])).body.error.code, "INVALID_CURSOR");
  assert.deepEqual((await call("GET", "/me/games", actors[1])).body.items, []);
  assert.equal(await db.activeGameMembership.count({ where: { userId: actors[0].id } }), 0);
});

test("günlük saat seçilmediyse etkinlik uydurulmaz; config ve IANA zaman dönüşümü doğrulanır", async () => {
  assert.deepEqual((await call("GET", "/games/daily")).body, { scheduleConfigured: false, event: null });
  assert.equal(await db.gameSession.count({ where: { kind: "DAILY" } }), 0);
  const baseEnv = { ...process.env };
  for (const fields of [{ DAILY_GAME_START_TIME: "20:00" }, { DAILY_GAME_START_TIME: "25:00", DAILY_GAME_TIME_ZONE: "Europe/Istanbul", DAILY_GAME_THEME_SLUG: "test" }, { DAILY_GAME_START_TIME: "20:00", DAILY_GAME_TIME_ZONE: "Bogus/Zone", DAILY_GAME_THEME_SLUG: "test" }, { GAME_INTERVAL_MS: "0" }]) assert.throws(() => readEnvironment({ ...baseEnv, ...fields }));
  const schedule = { startTime: "20:00", timeZone: "Europe/Istanbul", themeSlug: "test" };
  assert.equal(dailyGameStart("2026-10-10", schedule).toISOString(), "2026-10-10T17:00:00.000Z");
  assert.equal(gameLocalDay(new Date("2026-10-10T22:30:00Z"), schedule.timeZone), "2026-10-11");
  assert.throws(() => dailyGameStart("2026-03-08", { ...schedule, startTime: "02:30", timeZone: "America/New_York" }));
  assert.throws(() => dailyGameStart("2026-11-01", { ...schedule, startTime: "01:30", timeZone: "America/New_York" }));
});

test("OpenAPI oyun ve GAME medyasını belgeler; QR token ve yıldız doğal tekrarı ayrıdır", async () => {
  const schema = (await call("GET", "/openapi.json", null)).body;
  for (const path of ["/v1/games/daily", "/v1/games/{id}", "/v1/games/{id}/ballot", "/v1/games/{id}/results", "/v1/me/games"]) assert.ok(schema.paths[path].get.security.some((item: any) => "bearer" in item));
  assert.ok(schema.paths["/v1/games/lobbies"].post.parameters.some((item: any) => item.name === "Idempotency-Key" && item.required));
  assert.ok(!schema.paths["/v1/games/{id}/invite"].post.parameters.some((item: any) => item.name === "Idempotency-Key"));
  assert.ok(!schema.paths["/v1/games/{id}/submissions/{submissionId}/rating"].put.parameters.some((item: any) => item.name === "Idempotency-Key"));
  assert.equal(schema.components.schemas.GameScoreDto.properties.themeFits, undefined);
  assert.ok(schema.components.schemas.CreateUploadDto.properties.purpose.enum.includes("GAME"));
});

test("planlı lobi saatinde kendiliğinden başlar; iki üye yoksa iptal olur, geçersiz saat reddedilir", async () => {
  const soon = new Date(Date.now() + 10000).toISOString();
  const rejected = await call("POST", "/games/lobbies", actors[0], { themeTitle: "Plan", startsAt: soon });
  assert.equal(rejected.status, 422); assert.equal(rejected.body.error.code, "INVALID_START_TIME");
  const later = new Date(Date.now() + 7200000).toISOString();
  const { id } = await group(2, { startsAt: later });
  const waiting = await state(id);
  assert.equal(waiting.phase, "WAITING"); assert.equal(waiting.isPublic, false);
  assert.equal(new Date(waiting.phaseEndsAt).toISOString(), later, "Bekleyen planlı lobi başlangıca geri sayar.");
  const startsAt = new Date(Date.now() - 1000);
  await db.gameSession.update({ where: { id }, data: { startsAt } });
  await app.get(GameLifecycleService).scan();
  const started = await state(id);
  assert.equal(started.phase, "SUBMISSION");
  assert.equal(new Date(started.submissionEndsAt).getTime(), startsAt.getTime() + 60000, "Süre planlı saatten başlar, işçi gecikmesi uzatmaz.");
  const alone = await lobby({ startsAt: later });
  await db.gameSession.update({ where: { id: alone.id }, data: { startsAt: new Date(Date.now() - 1000) } });
  await app.get(GameLifecycleService).scan();
  const cancelled = await state(alone.id);
  assert.equal(cancelled.phase, "CANCELLED"); assert.equal(cancelled.cancelReason, "NOT_ENOUGH_PLAYERS");
});

test("herkese açık lobi Hızlı eşleş'te listelenir ve davetsiz katılınır; davetli lobi listelenmez, dolu lobi çıkar", async () => {
  const open = await lobby({ isPublic: true, maxMembers: 2 });
  const invited = await lobby();
  const listed = await call("GET", "/games/open", actors[1]);
  assert.equal(listed.status, 200);
  const ids = listed.body.map((row: { id: string }) => row.id);
  assert.ok(ids.includes(open.id)); assert.ok(!ids.includes(invited.id));
  assert.equal(listed.body.find((row: { id: string }) => row.id === open.id).memberCount, 1);
  assert.equal((await call("POST", `/games/${invited.id}/join`, actors[1], {})).status, 404, "Davetli lobi oda kimliğiyle açılmaz.");
  const joined = await call("POST", `/games/${open.id}/join`, actors[1], {});
  assert.equal(joined.status, 200, JSON.stringify(joined.body)); assert.equal(joined.body.memberCount, 2);
  const full = await call("GET", "/games/open", actors[2]);
  assert.ok(!full.body.some((row: { id: string }) => row.id === open.id), "Dolu lobi listelenmez.");
  assert.equal((await call("POST", `/games/${open.id}/join`, actors[2], {})).body.error.code, "ROOM_FULL");
});

test("herkes oylayınca oylama süreyi beklemeden biter; davetli odada sıralama var, lig puanı yok", async () => {
  const row = await voting();
  const rate = (actor: Actor, submissionId: string, stars: number) => call("PUT", `/games/${row.id}/submissions/${submissionId}/rating`, actor, { stars });
  assert.equal((await rate(actors[2], row.first.submissionId, 5)).status, 200);
  assert.equal((await rate(actors[2], row.second.submissionId, 3)).status, 200);
  assert.equal((await rate(actors[0], row.second.submissionId, 4)).status, 200);
  assert.equal((await state(row.id)).phase, "VOTING", "Bir üye henüz oylamadı.");
  assert.equal((await rate(actors[1], row.first.submissionId, 4)).status, 200);
  const finished = await state(row.id);
  assert.equal(finished.phase, "COMPLETED", "Son oyla sonuçlar açılır.");
  const result = await call("GET", `/games/${row.id}/results`, actors[2]);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.items.map((item: { rank: number; author: { id: string } }) => [item.rank, item.author.id]), [[1, actors[0].id], [2, actors[1].id]]);
  assert.equal(result.body.official, false); assert.equal(result.body.league, null); assert.equal(result.body.totalPoints, null);
  assert.equal(await db.gameLeaguePoint.count({ where: { sessionId: row.id } }), 0);
});

test("herkese açık defilede ilk üç 50/30/20 lig puanı alır; sonuç ve /me/league toplamı gösterir", async () => {
  const { id } = await group(3, { isPublic: true });
  assert.equal((await command(id, "start")).status, 200);
  const subs = [];
  for (const actor of actors.slice(0, 3)) { const result = await submit(id, actor); assert.equal(result.status, 200); subs.push(result.body.submissionId); }
  assert.equal((await command(id, "end-submission")).body.phase, "VOTING");
  const stars = [[null, 4, 2], [5, null, 2], [5, 4, null]];
  for (const [voter, row] of stars.entries()) for (const [target, value] of row.entries()) {
    if (value !== null) assert.equal((await call("PUT", `/games/${id}/submissions/${subs[target]}/rating`, actors[voter], { stars: value })).status, 200);
  }
  assert.equal((await state(id)).phase, "COMPLETED");
  const result = await call("GET", `/games/${id}/results`, actors[0]);
  assert.equal(result.body.official, true); assert.equal(result.body.myRank, 1); assert.equal(result.body.awardedPoints, 50);
  assert.deepEqual(result.body.items.map((item: { rank: number; awardedPoints: number; ratingCount: number }) => [item.rank, item.awardedPoints, item.ratingCount]), [[1, 50, 2], [2, 30, 2], [3, 20, 2]]);
  assert.equal(result.body.totalPoints, 50); assert.equal(result.body.league.name, "Bronz Lig"); assert.equal(result.body.league.remaining, 450);
  assert.deepEqual((await call("GET", "/me/league", actors[1])).body, { totalPoints: 30, league: { name: "Bronz Lig", nextName: "Gümüş Lig", current: 30, span: 500, remaining: 470 } });
});

test("Podyum Turu herkese aynı yarışmacıyı sırayla gösterir; oy sayısı ve kendi sırası görünür", async () => {
  const row = await voting();
  const first = await call("GET", `/games/${row.id}/turn`, actors[0]);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.index, 0); assert.equal(first.body.total, 2); assert.equal(first.body.turnSeconds, 10);
  assert.equal(first.body.current.mine, true, "İlk yarışmacı host'un kombini.");
  assert.equal(first.body.voterCount, 2); assert.equal(first.body.votedCount, 0); assert.ok(first.body.nextNumber > first.body.current.number, "Sıradaki yarışmacı numarası büyüktür.");
  const other = await call("GET", `/games/${row.id}/turn`, actors[1]);
  assert.equal(other.body.current.id, first.body.current.id, "Herkese aynı kart."); assert.equal(other.body.myTurnIn, 1);
  assert.equal((await call("PUT", `/games/${row.id}/submissions/${first.body.current.id}/rating`, actors[1], { stars: 4 })).status, 200);
  const voted = await call("GET", `/games/${row.id}/turn`, actors[1]);
  assert.equal(voted.body.votedCount, 1); assert.equal(voted.body.current.myStars, 4);
  const shifted = new Date(Date.now() - 11000);
  await db.gameSession.update({ where: { id: row.id }, data: { startsAt: new Date(shifted.getTime() - 60000), submissionEndsAt: shifted, votingStartsAt: shifted, votingEndsAt: new Date(Date.now() + 9000) } });
  const next = await call("GET", `/games/${row.id}/turn`, actors[1]);
  assert.equal(next.body.index, 1); assert.equal(next.body.current.mine, true); assert.equal(next.body.myTurnIn, null); assert.equal(next.body.nextNumber, null, "Son oy penceresinde sonraki tur yok.");
});


test("günlük oy açılınca 30 dakika korunur ve herkes oy verse de pencere kısalmaz", async () => {
  const { row } = await daily();
  for (const actor of actors.slice(0, 3)) assert.equal((await call("POST", `/games/${row.id}/join`, actor, {})).status, 200);
  const end = new Date(Date.now() + 60000);
  await db.gameSession.update({ where: { id: row.id }, data: { phase: "SUBMISSION", startsAt: new Date(end.getTime() - 1800000), submissionEndsAt: end, votingStartsAt: end, votingEndsAt: new Date(end.getTime() + 1800000) } });
  const a = await submit(row.id, actors[0]), b = await submit(row.id, actors[1]); assert.equal(a.status, 200); assert.equal(b.status, 200);
  const from = new Date(Date.now() - 1000);
  await db.gameSession.update({ where: { id: row.id }, data: { submissionEndsAt: from, votingStartsAt: from, votingEndsAt: new Date(from.getTime() + 1800000) } });
  const opened = await state(row.id); assert.equal(opened.phase, "VOTING"); assert.equal(Date.parse(opened.votingEndsAt) - Date.parse(opened.votingStartsAt), 1800000);
  for (const [actor, targets] of [[actors[0], [b.body.submissionId]], [actors[1], [a.body.submissionId]], [actors[2], [a.body.submissionId, b.body.submissionId]]] as const)
    for (const id of targets) assert.equal((await call("PUT", `/games/${row.id}/submissions/${id}/rating`, actor, { stars: 5 })).status, 200);
  const final = await state(row.id); assert.equal(final.phase, "VOTING"); assert.equal(final.votingEndsAt, opened.votingEndsAt);
});

test("sunum turları pencere içinde tekrar eder, son kartta takılmaz ve son süreyi aşmaz", async () => {
  const row = await voting(), start = new Date(Date.now() - 25000), end = new Date(start.getTime() + 120000);
  await db.gameSession.update({ where: { id: row.id }, data: { startsAt: new Date(start.getTime() - 60000), submissionEndsAt: start, votingStartsAt: start, votingEndsAt: end } });
  const turn = await call("GET", `/games/${row.id}/turn`, actors[0]); assert.equal(turn.status, 200); assert.equal(turn.body.index, 0); assert.equal(turn.body.cycle, 2); assert.equal(turn.body.current.mine, true); assert.ok(Date.parse(turn.body.turnEndsAt) <= end.getTime()); assert.equal(turn.body.votingEndsAt, end.toISOString());
  assert.ok(turn.body.remainingSeconds > 80); assert.ok(turn.body.nextNumber);
});
