import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, afterEach, test } from "node:test";
import { io, type Socket } from "socket.io-client";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const load = (path: string) => import(new URL(`../dist/${path}.js`, import.meta.url).href);
const { createApp } = await load("create-app") as { createApp: () => Promise<NestExpressApplication> };
const { PrismaService } = await load("database/prisma.service");
const { OutboxDispatcher, OutboxRegistry } = await load("common/outbox/outbox-dispatcher");
const { GameRealtimeGateway, GAME_REALTIME_LIMITS } = await load("modules/games/game-realtime.gateway");
type Actor = { id: string; token: string };
type Changed = { eventId: string; sessionId: string; version: number; serverNow: string };
let app: NestExpressApplication; let db: PrismaClient; let origin: string; let directory: string;
let actors: Actor[]; let ids: string[]; let clients: Socket[];
const envKeys = ["NODE_ENV", "AUTH_MOCK_ENABLED", "CORS_ORIGINS", "PUSH_PROVIDER", "LOCAL_PUSH_DIR", "DAILY_GAME_START_TIME", "DAILY_GAME_TIME_ZONE", "DAILY_GAME_THEME_SLUG"] as const;
const original = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

async function http(method: string, path: string, actor = actors[0], body?: unknown) {
  const response = await fetch(`${origin}/v1${path}`, { method, headers: { Authorization: `Bearer ${actor.token}`, "Idempotency-Key": randomUUID(),
    ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json() as any;
  assert.ok(response.ok, JSON.stringify({ status: response.status, data })); return data;
}
function socket(actor = actors[0], options: Record<string, unknown> = {}) {
  const client = io(`${origin}/games`, { transports: ["websocket"], reconnection: false, autoConnect: false, auth: { accessToken: actor.token }, ...options });
  clients.push(client); return client;
}
function event<T = any>(client: Socket, name: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (data: T) => { clearTimeout(timer); resolve(data); };
    const timer = setTimeout(() => { client.off(name, handler); reject(new Error(`Socket event timeout: ${name}`)); }, 5000);
    client.once(name, handler);
  });
}
async function connect(actor = actors[0], options: Record<string, unknown> = {}) {
  const client = socket(actor, options); const connected = event(client, "connect"); client.connect(); await connected; return client;
}
const emit = (client: Socket, name: string, body: unknown) => client.timeout(5000).emitWithAck(name, body) as Promise<any>;
const drain = () => app.get(OutboxDispatcher).drain() as Promise<number>;
async function lobby() {
  const row = await http("POST", "/games/lobbies", actors[0], { themeTitle: "90'lar", submissionSeconds: 60, votingSeconds: 60 }); ids.push(row.id); return row;
}
async function command(id: string, action: string) {
  const state = await http("GET", `/games/${id}`); return http("POST", `/games/${id}/${action}`, actors[0], { expectedVersion: state.version });
}
async function group() {
  const row = await lobby(); const invite = await command(row.id, "invite");
  await http("POST", "/games/join", actors[1], { token: invite.token }); return { ...row, token: invite.token };
}
async function submit(id: string, actor: Actor) {
  const media = await db.mediaAsset.create({ data: { ownerId: actor.id, purpose: "GAME", status: "READY", uploadKey: randomUUID(),
    displayKey: randomUUID(), thumbnailKey: randomUUID(), previewAcceptedAt: new Date() } });
  return http("PUT", `/games/${id}/submission`, actor, { mediaId: media.id });
}
async function source(id: string, type: string) {
  return db.outboxEvent.findFirstOrThrow({ where: { aggregateId: id, type }, orderBy: { createdAt: "desc" } });
}
function collected(client: Socket) { const messages: Changed[] = []; client.on("game.changed", (value: Changed) => messages.push(value)); return messages; }

beforeEach(async () => {
  process.env.NODE_ENV = "test"; process.env.AUTH_MOCK_ENABLED = "true"; process.env.CORS_ORIGINS = "https://podyum.test"; process.env.PUSH_PROVIDER = "local";
  delete process.env.DAILY_GAME_START_TIME; delete process.env.DAILY_GAME_TIME_ZONE; delete process.env.DAILY_GAME_THEME_SLUG;
  directory = await mkdtemp(join(tmpdir(), "podyum-realtime-")); process.env.LOCAL_PUSH_DIR = directory;
  actors = []; ids = []; clients = [];
  app = await createApp(); await app.listen(0, "127.0.0.1"); origin = await app.getUrl(); db = app.get(PrismaService);
  for (let index = 0; index < 3; index++) {
    const token = (await http("POST", "/auth/mock", { id: "", token: "" }, { provider: "google", subject: `realtime_${randomUUID()}`, acknowledgeMock: true })).accessToken;
    const actor = { id: "", token }; actor.id = (await http("GET", "/auth/me", actor)).user.id; actors.push(actor);
  }
});
afterEach(async () => {
  try {
    for (const client of clients) client.disconnect();
    await app.get(GameRealtimeGateway).onModuleDestroy();
    const users = actors.map((actor) => actor.id);
    await db.$transaction(async (tx) => {
      await tx.outboxEvent.deleteMany({ where: { OR: [{ aggregateId: { in: [...ids, ...users] } },
        ...users.map((userId) => ({ type: "notification.created", payload: { path: ["userId"], equals: userId } }))] } });
      await tx.notification.deleteMany({ where: { userId: { in: users } } });
      await tx.idempotencyRecord.deleteMany({ where: { userId: { in: users } } });
      await tx.gameOutcome.deleteMany({ where: { sessionId: { in: ids } } });
      await tx.gameScore.deleteMany({ where: { sessionId: { in: ids } } });
      await tx.gameSubmission.deleteMany({ where: { sessionId: { in: ids } } });
      await tx.gameMembership.deleteMany({ where: { sessionId: { in: ids } } });
      await tx.gameSession.deleteMany({ where: { id: { in: ids } } });
      await tx.mediaAsset.deleteMany({ where: { ownerId: { in: users } } });
      await tx.block.deleteMany({ where: { OR: [{ blockerId: { in: users } }, { blockedId: { in: users } }] } });
      await tx.friendship.deleteMany({ where: { OR: [{ userAId: { in: users } }, { userBId: { in: users } }] } });
      await tx.deviceToken.deleteMany({ where: { userId: { in: users } } });
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

test("canlı bağlantı geçerli oturum ister; query tokenı kimlik doğrulamaz", async () => {
  for (const options of [{ auth: {} }, { auth: { accessToken: "wrong" } }, { auth: {}, query: { accessToken: actors[0].token } }]) {
    const client = socket(actors[0], options); const failed = event(client, "connect_error"); client.connect();
    assert.equal((await failed).data.code, "AUTH_REQUIRED"); assert.equal(client.connected, false);
  }
  await db.authSession.updateMany({ where: { userId: actors[0].id }, data: { revokedAt: new Date() } });
  const client = socket(); const failed = event(client, "connect_error"); client.connect(); assert.equal((await failed).data.code, "INVALID_SESSION");
  await db.user.update({ where: { id: actors[1].id }, data: { status: "SUSPENDED" } });
  const suspended = socket(actors[1]); const denied = event(suspended, "connect_error"); suspended.connect(); assert.equal((await denied).data.code, "ACCOUNT_SUSPENDED");
});

test("native originsiz bağlanır; web origin yalnız izin listesiyle bağlanır", async () => {
  await connect(); await connect(actors[1], { extraHeaders: { Origin: "https://podyum.test" } });
  const client = socket(actors[2], { extraHeaders: { Origin: "https://untrusted.test" } });
  const failed = event(client, "connect_error"); client.connect(); await failed; assert.equal(client.connected, false);
});

test("oda kimliği veya QR tokenı socket üyeliği vermez; gövde katıdır", async () => {
  const row = await group(); const member = await connect(); const outsider = await connect(actors[2]);
  for (const body of [null, [], {}, { sessionId: "wrong" }, { sessionId: row.id, userId: actors[0].id }, { sessionId: row.id, token: row.token }]) {
    assert.equal((await emit(member, "game.subscribe", body)).error.code, "VALIDATION_ERROR");
  }
  assert.equal((await emit(outsider, "game.subscribe", { sessionId: row.id })).error.code, "RESOURCE_NOT_FOUND");
  assert.equal((await emit(member, "game.subscribe", { sessionId: randomUUID() })).error.code, "RESOURCE_NOT_FOUND");
  const first = await emit(member, "game.subscribe", { sessionId: row.id }); assert.equal(first.ok, true);
  assert.equal(first.data.state.isHost, true); assert.equal(first.data.state.mySubmission, null); assert.ok(first.data.state.serverNow);
  assert.equal(JSON.stringify(first).includes(row.token), false);
  assert.equal((await emit(member, "game.subscribe", { sessionId: row.id })).ok, true);
});

test("outbox yalnız abonelere güvenli güncelleme sinyali verir; abonelikten çıkış durdurur", async () => {
  const row = await group(); const member = await connect(actors[1]); const outsider = await connect(actors[2]);
  await emit(member, "game.subscribe", { sessionId: row.id }); const messages = collected(member); const leaked = collected(outsider);
  const changed = event<Changed>(member, "game.changed"); await command(row.id, "start"); await drain();
  const signal = await changed;
  assert.deepEqual(Object.keys(signal).sort(), ["eventId", "sessionId", "serverNow", "version"].sort());
  assert.equal(signal.sessionId, row.id); assert.ok(signal.version > row.version); assert.ok(Date.parse(signal.serverNow));
  const serialized = JSON.stringify(messages);
  for (const value of [row.token, actors[0].id, actors[1].id, "90'lar", "stars", "mediaId", "voterId", "inviteHash"]) assert.equal(serialized.includes(value), false, value);
  assert.equal((await emit(outsider, "game.unsubscribe", { sessionId: row.id })).ok, true); assert.deepEqual(leaked, []);
  await emit(member, "game.unsubscribe", { sessionId: row.id }); const count = messages.length;
  await app.get(GameRealtimeGateway).deliver(await source(row.id, "game.submission.opened"));
  await emit(member, "game.unsubscribe", { sessionId: row.id }); assert.equal(messages.length, count);
});

test("kişisel snapshot başka üyenin teslimini açmaz; yıldız ve sonuç sinyali ham oy taşımaz", async () => {
  const row = await group(); await command(row.id, "start"); const first = await submit(row.id, actors[0]); const second = await submit(row.id, actors[1]);
  const host = await connect(); const member = await connect(actors[1]); await emit(host, "game.subscribe", { sessionId: row.id });
  const snapshot = await emit(member, "game.subscribe", { sessionId: row.id });
  assert.equal(snapshot.data.state.mySubmission.id, second.submissionId); assert.equal(JSON.stringify(snapshot).includes(first.mediaId), false);
  await command(row.id, "end-submission"); await drain();
  const changed = event<Changed>(host, "game.changed"); await http("PUT", `/games/${row.id}/submissions/${second.submissionId}/rating`, actors[0], { stars: 5 }); await drain();
  assert.deepEqual(Object.keys(await changed).sort(), ["eventId", "sessionId", "serverNow", "version"].sort());
  assert.equal((await db.gameScore.findMany({ where: { sessionId: row.id } })).length, 1);
  await db.gameSession.update({ where: { id: row.id }, data: { startsAt: new Date(Date.now() - 180000), submissionEndsAt: new Date(Date.now() - 120000), votingStartsAt: new Date(Date.now() - 120000), votingEndsAt: new Date(Date.now() - 1000) } });
  const resultSignal = event(member, "game.changed");
  assert.equal((await http("GET", `/games/${row.id}`)).phase, "COMPLETED"); await drain(); await resultSignal;
  assert.equal((await http("GET", `/games/${row.id}/results`, actors[1])).items.length, 2);
});

test("lobiden ayrılma aboneliği kaldırır; sonraki değişiklik üyeye sızmaz", async () => {
  const row = await group(); const member = await connect(actors[1]); await emit(member, "game.subscribe", { sessionId: row.id }); const messages = collected(member);
  const revoked = event(member, "game.access-revoked"); await http("POST", `/games/${row.id}/leave`, actors[1], {}); await drain();
  assert.deepEqual(await revoked, { sessionId: row.id });
  assert.equal((await emit(member, "game.unsubscribe", { sessionId: row.id })).ok, true); assert.deepEqual(messages, []);
  assert.equal((await emit(member, "game.subscribe", { sessionId: row.id })).error.code, "RESOURCE_NOT_FOUND");
});

test("hostla engel anında tekrar denetlenir ve sosyal olay aboneliği kapatır", async () => {
  const row = await group(); const member = await connect(actors[1]); await emit(member, "game.subscribe", { sessionId: row.id }); const messages = collected(member);
  const revoked = event(member, "game.access-revoked"); await http("PUT", `/blocks/${actors[0].id}`, actors[1], {}); await drain();
  assert.deepEqual(await revoked, { sessionId: row.id });
  await emit(member, "game.unsubscribe", { sessionId: row.id }); assert.deepEqual(messages, []);
  assert.equal((await emit(member, "game.subscribe", { sessionId: row.id })).error.code, "RESOURCE_NOT_FOUND");
});

test("çıkış ve süresi biten erişim tokenı canlı bağlantıyı kapatır", async () => {
  const row = await group(); const host = await connect(); await emit(host, "game.subscribe", { sessionId: row.id }); const messages = collected(host);
  const disconnected = event(host, "disconnect"); const authError = event(host, "game.error");
  await http("POST", "/auth/logout", actors[0], {}); await app.get(GameRealtimeGateway).deliver(await source(row.id, "game.created"));
  assert.equal((await authError).code, "INVALID_SESSION"); await disconnected; assert.deepEqual(messages, []);
  const member = await connect(actors[1]); await emit(member, "game.subscribe", { sessionId: row.id });
  await db.authSession.updateMany({ where: { userId: actors[1].id }, data: { accessExpiresAt: new Date(Date.now() - 1000) } });
  const expired = event(member, "disconnect"); await app.get(GameRealtimeGateway).sweep(); await expired;
});

test("tekrar ve sırasız kaynak olaylar güncel sürüme işaret eder; yeniden bağlanma güncel state döndürür", async () => {
  const row = await group(); const client = await connect(); await emit(client, "game.subscribe", { sessionId: row.id });
  const old = await source(row.id, "game.created"); const started = await command(row.id, "start"); const recent = await source(row.id, "game.submission.opened");
  for (const sourceEvent of [recent, old, recent]) {
    const changed = event<Changed>(client, "game.changed"); await app.get(GameRealtimeGateway).deliver(sourceEvent);
    assert.equal((await changed).version, started.version);
  }
  client.disconnect(); await submit(row.id, actors[0]);
  const reconnected = await connect(); const snapshot = await emit(reconnected, "game.subscribe", { sessionId: row.id });
  assert.ok(snapshot.data.state.version > started.version); assert.equal(snapshot.data.state.phase, "SUBMISSION"); assert.ok(snapshot.data.state.mySubmission.id);
});

test("başarısız transaction canlı sinyal üretmez; outbox yeniden denemesi güvenlidir", async () => {
  const row = await group(); const client = await connect(); await emit(client, "game.subscribe", { sessionId: row.id }); await drain(); const messages = collected(client);
  await assert.rejects(db.$transaction(async (tx) => {
    await tx.gameSession.update({ where: { id: row.id }, data: { version: { increment: 1 } } });
    await tx.outboxEvent.create({ data: { type: "game.settings.changed", aggregateType: "game-session", aggregateId: row.id, aggregateVersion: 999, payload: { secret: "never deliver" } } });
    throw new Error("rollback");
  }), /rollback/);
  await drain(); await emit(client, "game.unsubscribe", { sessionId: row.id }); assert.deepEqual(messages, []);
  await emit(client, "game.subscribe", { sessionId: row.id });
  let fail = true; app.get(OutboxRegistry).register({ name: "realtime-retry-test", types: ["game.submission.opened"], deliver: async () => { if (fail) throw new Error("simulated"); } });
  await command(row.id, "start"); const changed = event(client, "game.changed"); await drain(); await changed;
  const sourceEvent = await source(row.id, "game.submission.opened"); assert.equal(sourceEvent.publishedAt, null);
  fail = false; await db.outboxEvent.update({ where: { id: sourceEvent.id }, data: { availableAt: new Date() } });
  const replayed = event<Changed>(client, "game.changed"); await drain(); assert.equal((await replayed).eventId, sourceEvent.id);
  assert.ok((await source(row.id, "game.submission.opened")).publishedAt);
});

test("abonelik ve mesaj sınırları uygulanır; socket komutları oyun durumunu değiştiremez", async () => {
  const client = await connect();
  for (let index = 0; index < GAME_REALTIME_LIMITS.subscriptionsPerConnection; index++) {
    const row = await lobby(); assert.equal((await emit(client, "game.subscribe", { sessionId: row.id })).ok, true);
  }
  const extra = await lobby(); assert.equal((await emit(client, "game.subscribe", { sessionId: extra.id })).error.code, "SUBSCRIPTION_LIMIT");
  const before = (await db.gameSession.findUniqueOrThrow({ where: { id: extra.id } })).version;
  client.emit("game.start", { sessionId: extra.id }); client.emit("game.rating", { sessionId: extra.id, stars: 5 });
  await emit(client, "game.unsubscribe", { sessionId: extra.id }); assert.equal((await db.gameSession.findUniqueOrThrow({ where: { id: extra.id } })).version, before);
  let limited = false;
  for (let index = 0; index < GAME_REALTIME_LIMITS.messagesPerWindow; index++) {
    const result = await emit(client, "game.unsubscribe", { sessionId: extra.id }); if (result.error?.code === "RATE_LIMITED") limited = true;
  }
  assert.equal(limited, true);
});

test("aynı kullanıcının bağlantı sayısı sınırlıdır; kopan bağlantı yer açar", async () => {
  for (let index = 0; index < GAME_REALTIME_LIMITS.connectionsPerUser; index++) await connect();
  const extra = socket(); const rejected = event(extra, "game.error"); const disconnected = event(extra, "disconnect"); extra.connect();
  assert.equal((await rejected).code, "CONNECTION_LIMIT"); await disconnected;
  const server = app.get(GameRealtimeGateway);
  const first = clients[0]; first.disconnect(); await server.sweep();
  // Yeni handshake eski bağlantının disconnect paketiyle aynı soketi kullanmaz.
  const next = await connect(); assert.equal(next.connected, true);
});
