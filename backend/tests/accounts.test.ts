import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
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
const { AccountErasureService } = await load("modules/accounts/account-erasure.service");
const { GameLifecycleService } = await load("modules/games/game-lifecycle.service");
const { PUSH_PROVIDER } = await load("modules/notifications/push/push-provider");
const { ImageProcessor } = await load("modules/media/image-processor.service");
const { MediaService } = await load("modules/media/media.service");
const { hashToken, newToken, hashPassword } = await load("modules/auth/crypto");
const { OutboxDispatcher } = await load("common/outbox/outbox-dispatcher");
type Actor = { id: string; token: string; subject: string; refresh?: string };
let app: NestExpressApplication; let db: PrismaClient; let origin: string; let directory: string;
let actors: Actor[]; let polls: string[]; let games: string[]; let clients: Socket[];
const envKeys = ["NODE_ENV", "AUTH_MOCK_ENABLED", "LOCAL_MEDIA_DIR", "LOCAL_PUSH_DIR", "LOCAL_MAILBOX_DIR", "PUSH_PROVIDER", "DAILY_GAME_START_TIME", "DAILY_GAME_TIME_ZONE", "DAILY_GAME_THEME_SLUG"] as const;
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
  directory = await mkdtemp(join(tmpdir(), "podyum-accounts-")); process.env.LOCAL_MEDIA_DIR = join(directory, "media"); process.env.LOCAL_PUSH_DIR = join(directory, "push"); process.env.LOCAL_MAILBOX_DIR = join(directory, "mail");
  actors = []; polls = []; games = []; clients = [];
  app = await createApp(); await app.listen(0, "127.0.0.1"); origin = await app.getUrl(); db = app.get(PrismaService);
  for (let index = 0; index < 4; index++) {
    const subject = `account_${randomUUID()}`;
    const session = await http("POST", "/auth/mock", null, { provider: "google", subject, acknowledgeMock: true }); assert.equal(session.status, 200);
    const actor = { id: "", token: session.body.accessToken, refresh: session.body.refreshToken, subject }; actor.id = (await ok("GET", "/auth/me", actor)).user.id;
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
      const jobs = (await tx.accountDeletion.findMany({ where: { userId: { in: users } }, select: { id: true } })).map((row) => row.id);
      const resources = [...users, ...polls, ...games, ...comments, ...reports, ...jobs];
      const audits = (await tx.moderationAudit.findMany({ where: { OR: [{ actorId: { in: users } }, { resourceId: { in: resources } }] }, select: { id: true } })).map((row) => row.id);
      await tx.outboxEvent.deleteMany({ where: { OR: [{ aggregateId: { in: [...resources, ...audits] } },
        ...users.map((userId) => ({ type: "notification.created", payload: { path: ["userId"], equals: userId } }))] } });
      await tx.accountDeletion.deleteMany({ where: { userId: { in: users } } });
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
      await tx.productTag.deleteMany({ where: { option: { pollId: { in: polls } } } });
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
      await tx.authActionToken.deleteMany({ where: { userId: { in: users } } });
      await tx.authCredential.deleteMany({ where: { userId: { in: users } } });
      await tx.authIdentity.deleteMany({ where: { userId: { in: users } } });
      await tx.user.deleteMany({ where: { id: { in: users } } });
    }, { timeout: 30000 });
  } finally {
    await app?.close(); await rm(directory, { recursive: true, force: true });
    for (const key of envKeys) { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; }
  }
});


const remove = (actor = actors[1], body: unknown = { confirmDeletion: true }) => http("DELETE", "/me/account", actor, body);
const erase = (actor = actors[1]) => app.get(AccountErasureService).erase(actor.id);

test("hesap silme oturum, açık onay ve yeni giriş ister; token yenileme yaş sınırını aşamaz", async () => {
  assert.equal((await http("DELETE", "/me/account", null, { confirmDeletion: true })).status, 401);
  for (const body of [{}, { confirmDeletion: false }, { confirmDeletion: "true" }, { confirmDeletion: true, userId: actors[2].id }]) assert.equal((await remove(actors[1], body)).status, 400);
  await db.authSession.updateMany({ where: { userId: actors[1].id }, data: { createdAt: new Date(Date.now() - 16 * 60_000) } });
  const refreshed = await ok("POST", "/auth/refresh", actors[1], { refreshToken: actors[1].refresh });
  actors[1].token = refreshed.accessToken;
  assert.equal((await remove()).body.error.code, "RECENT_LOGIN_REQUIRED");
  assert.equal(await db.accountDeletion.count({ where: { userId: actors[1].id } }), 0);
  assert.equal((await remove(actors[0])).body.error.code, "PROTECTED_ADMIN");
});

test("silme kabulü giriş/özel profil/oturum/cihazı atomik temizler ve diğer hesabı etkilemez", async () => {
  const actor = actors[1]; const password = "account-deletion-test-password";
  await db.authCredential.create({ data: { userId: actor.id, email: `${actor.id}@example.com`, passwordHash: await hashPassword(password), emailVerifiedAt: new Date() } });
  await db.userPrivate.create({ data: { userId: actor.id, gender: "WOMAN", ageBand: "AGE_18_24", cityCode: "34", analyticsConsentAt: new Date(), analyticsRevision: 3 } });
  await db.userSettings.create({ data: { userId: actor.id } });
  await db.user.update({ where: { id: actor.id }, data: { bio: "Özel biyografi", displayName: "Silinecek Ad" } });
  await ok("PUT", `/me/devices/${randomUUID()}`, actor, { token: `device_${randomUUID()}`, platform: "ios" });
  const result = await remove(); assert.equal(result.status, 202); assert.equal(result.body.status, "ACCEPTED");
  const saved = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  assert.equal(saved.status, "DELETED"); assert.equal(saved.displayName, "Silinmiş kullanıcı"); assert.equal(saved.bio, null); assert.notEqual(saved.username, actor.subject);
  for (const model of [db.authCredential, db.authSession, db.authIdentity, db.userPrivate, db.userSettings, db.deviceToken] as any[]) assert.equal(await model.count({ where: { userId: actor.id } }), 0);
  assert.equal((await http("GET", "/auth/me", actor)).status, 401); assert.equal((await remove()).status, 401);
  assert.equal((await http("GET", `/users/${actor.id}`, actors[2])).status, 404);
  assert.equal((await http("GET", "/auth/me", actors[2])).status, 200);
  assert.equal((await http("POST", "/auth/login", null, { email: `${actor.id}@example.com`, password })).status, 401);
  assert.equal(await db.accountDeletion.count({ where: { userId: actor.id } }), 1);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: result.body.deletionId, type: "account.deletion.requested" } }), 1);
});

test("geçmiş tercihler ve başkasının sonuç toplamı kalır, demografi ve nedenler temizlenir", async () => {
  const row = await poll();
  await db.userPrivate.create({ data: { userId: actors[2].id, gender: "WOMAN", ageBand: "AGE_18_24", analyticsConsentAt: new Date() } });
  await ok("PUT", `/polls/${row.id}/vote`, actors[2], { optionId: row.options[0].id });
  await ok("PUT", `/polls/${row.id}/reason`, actors[2], { reason: "COLOR_HARMONY" });
  const before = await ok("GET", `/polls/${row.id}/results`, actors[1]); assert.equal(before.totalVotes, 1);
  assert.equal((await remove(actors[2])).status, 202);
  const vote = await db.pollVote.findUniqueOrThrow({ where: { pollId_voterId: { pollId: row.id, voterId: actors[2].id } } });
  assert.equal(vote.genderAtVote, null); assert.equal(vote.analyticsConsentAtVote, null);
  await erase(actors[2]); const after = await ok("GET", `/polls/${row.id}/results`, actors[1]);
  assert.equal(after.totalVotes, before.totalVotes); assert.deepEqual(after.options, before.options);
  assert.equal(await db.pollVoteReason.count({ where: { voterId: actors[2].id } }), 0);
});

test("paylaşım/yorum/linkler temizlenir; bağlı medya orijinalleri de diskten kalkar", async () => {
  const row = await poll(); const mediaId = row.options[0].mediaId;
  await db.productTag.create({ data: { optionId: row.options[0].id, title: "Kişisel ürün", externalUrl: "https://example.com/personal" } });
  await ok("POST", `/polls/${row.id}/comments`, actors[1], { body: "Silinecek yorum" });
  await ok("PUT", `/polls/${row.id}/save`, actors[2]);
  const reported = await report("POLL", row.id);
  await app.get(LocalMediaStorage).write(row.options[0].media.uploadKey, photo);
  assert.equal((await remove()).status, 202);
  assert.equal((await http("GET", `/polls/${row.id}`, actors[2])).status, 404);
  assert.equal((await media(`/admin/reports/${reported.id}/media/${mediaId}/content`)).status, 404);
  await erase(); const saved = await db.poll.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(saved.contentStatus, "REMOVED"); assert.equal(saved.question, "");
  assert.equal(await db.productTag.count({ where: { option: { pollId: row.id } } }), 0);
  assert.equal((await db.comment.findFirstOrThrow({ where: { pollId: row.id } })).body, "");
  for (const option of row.options) {
    const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: option.mediaId } }); assert.equal(asset.status, "DELETED"); assert.ok(asset.filesPurgedAt);
    for (const key of [option.media.uploadKey, option.media.displayKey, option.media.thumbnailKey]) if (key) await assert.rejects(app.get(LocalMediaStorage).read(key), { code: "ENOENT" });
  }
  const detail = await ok("GET", `/admin/reports/${reported.id}`); assert.equal(detail.target.question, "");
});

test("disk hatasında iş tamamlanmaz, erişim kapalı kalır ve tekrar aynı işi tamamlar", async () => {
  await poll(); await remove(); const storage = app.get(LocalMediaStorage); const original = storage.remove;
  storage.remove = async () => { throw new Error("test disk failure"); };
  try {
    await assert.rejects(erase());
    await app.get(OutboxDispatcher).drain();
    const pending = await db.outboxEvent.findFirstOrThrow({ where: { type: "account.deletion.requested", payload: { path: ["userId"], equals: actors[1].id } } });
    assert.equal(pending.publishedAt, null); assert.equal(pending.attempts, 1); assert.ok(pending.availableAt > new Date());
  } finally { storage.remove = original; }
  assert.equal((await db.accountDeletion.findUniqueOrThrow({ where: { userId: actors[1].id } })).completedAt, null);
  assert.equal((await http("GET", "/auth/me", actors[1])).status, 401);
  const job = await db.accountDeletion.findUniqueOrThrow({ where: { userId: actors[1].id } });
  const status = await ok("GET", `/admin/users/${actors[1].id}/deletion`); assert.equal(status.status, "PENDING"); assert.ok(status.pendingMedia > 0);
  assert.equal((await erase()).completed, true); assert.equal((await erase()).changed, false);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: job.id, type: "account.deletion.completed" } }), 1);
  assert.equal((await ok("GET", `/admin/users/${actors[1].id}/deletion`)).status, "COMPLETED");
});

test("outbox hatası silme kabulünü ve kimlik temizliğini geri alır", async () => {
  const name = `test_deletion_${randomUUID().replaceAll("-", "")}`;
  await db.$executeRawUnsafe(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type = 'account.deletion.requested' THEN RAISE EXCEPTION 'test rollback'; END IF; RETURN NEW; END; $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER "${name}" BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION "${name}"()`);
  try {
    assert.equal((await remove()).status, 500);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: actors[1].id } })).status, "ACTIVE");
    assert.equal((await http("GET", "/auth/me", actors[1])).status, 200);
    assert.equal(await db.accountDeletion.count({ where: { userId: actors[1].id } }), 0);
  } finally { await db.$executeRawUnsafe(`DROP TRIGGER "${name}" ON "OutboxEvent"`); await db.$executeRawUnsafe(`DROP FUNCTION "${name}"()`); }
  assert.equal((await remove()).status, 202);
});

test("kalıcı outbox silme işini çalıştırır; host lobisi iptal olur ve socket kapanır", async () => {
  const row = await game(); const client = await connect(actors[1]); await client.timeout(5000).emitWithAck("game.subscribe", { sessionId: row.id });
  const disconnected = event(client, "disconnect"); await remove();
  await app.get(OutboxDispatcher).drain(); await disconnected;
  const session = await db.gameSession.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(session.phase, "CANCELLED"); assert.equal(session.cancelReason, "HOST_ACCOUNT_DELETED"); assert.equal(session.inviteHash, null);
  assert.equal(session.themeTitle, "Silinmiş lobi");
  assert.ok((await db.accountDeletion.findUniqueOrThrow({ where: { userId: actors[1].id } })).completedAt);
  assert.equal((await http("POST", "/games/invites/preview", actors[2], { token: row.token })).status, 404);
});

test("yerel posta/push kopyaları kaldırılır, başka hesabın canlı dosyası korunur", async () => {
  await mkdir(join(directory, "mail"), { recursive: true }); await mkdir(join(directory, "push"), { recursive: true });
  const token = newToken(); const hash = hashToken(token);
  await db.authActionToken.create({ data: { userId: actors[1].id, kind: "RESET_PASSWORD", tokenHash: hash, credentialVersion: 1, expiresAt: new Date(Date.now() + 60000) } });
  await writeFile(join(directory, "mail", "legacy.json"), JSON.stringify({ token, email: "private@example.com", expiresAt: new Date(Date.now() + 60000).toISOString() }));
  await writeFile(join(directory, "mail", "other.json"), JSON.stringify({ userId: actors[2].id, email: "other@example.com", expiresAt: new Date(Date.now() + 60000).toISOString() }));
  await writeFile(join(directory, "push", "mine.json"), JSON.stringify({ userId: actors[1].id }));
  await remove(); await erase();
  const sent = await app.get(PUSH_PROVIDER).send([{ userId: actors[1].id, to: "closed-device", title: "Test", body: "Test", ttlSeconds: 60, data: {} }]);
  assert.deepEqual(sent, ["rejected"]);
  await assert.rejects(readFile(join(directory, "mail", "legacy.json")), { code: "ENOENT" }); await assert.rejects(readFile(join(directory, "push", "mine.json")), { code: "ENOENT" });
  assert.ok(await readFile(join(directory, "mail", "other.json")));
  const job = await db.accountDeletion.findUniqueOrThrow({ where: { userId: actors[1].id } }); assert.deepEqual(job.mailTokenHashes, []);
  assert.equal((await http("POST", "/auth/password-reset/confirm", null, { token, password: "account-test-new-password" })).status, 400);
});

test("aynı sağlayıcıyla yeni giriş eski hesabı canlandırmaz; yeni hesap oluşur", async () => {
  const old = actors[1]; await remove(); await erase();
  const fresh = await ok("POST", "/auth/mock", actors[2], { provider: "google", subject: old.subject, acknowledgeMock: true });
  const me = await ok("GET", "/auth/me", { ...old, token: fresh.accessToken }); assert.notEqual(me.user.id, old.id);
  actors.push({ id: me.user.id, subject: old.subject, token: fresh.accessToken });
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: old.id } })).status, "DELETED");
});

test("temizlik aktif hesabı silemez; durum yalnız admin ve CHECK/OpenAPI korunur", async () => {
  assert.equal((await erase()).completed, false); assert.equal((await http("GET", `/admin/users/${actors[1].id}/deletion`, actors[2])).status, 403);
  assert.equal((await http("GET", `/admin/users/${actors[1].id}/deletion`, actors[0])).status, 404);
  await remove(); const job = await db.accountDeletion.findUniqueOrThrow({ where: { userId: actors[1].id } });
  await assert.rejects(db.accountDeletion.update({ where: { id: job.id }, data: { completedAt: new Date(job.requestedAt.getTime() - 1) } }));
  await assert.rejects(db.accountDeletion.update({ where: { id: job.id }, data: { completedAt: new Date(), mailTokenHashes: ["not-cleared"] } }));
  await assert.rejects(db.$executeRaw`UPDATE "AccountDeletion" SET "completedAt" = clock_timestamp(), "mailTokenHashes" = NULL WHERE "id" = ${job.id}::uuid`);
  const spec = await ok("GET", "/openapi.json"); assert.ok(spec.paths["/v1/me/account"].delete.responses["202"]);
  assert.deepEqual(spec.components.schemas.DeleteAccountDto.properties.confirmDeletion.enum, [true]);
  const status = await ok("GET", `/admin/users/${actors[1].id}/deletion`); assert.equal("mailTokenHashes" in status, false);
});

test("silinen oyun seçmeninin yıldızları başkasının tamamlanmış sonuçlarını değiştirmez", async () => {
  const session = await game(); await ok("POST", "/games/join", actors[3], { token: session.token });
  let state = await ok("GET", `/games/${session.id}`, actors[1]);
  await ok("POST", `/games/${session.id}/start`, actors[1], { expectedVersion: state.version });
  const submitted = [];
  for (const actor of [actors[1], actors[3]]) {
    const id = randomUUID();
    const asset = await db.mediaAsset.create({ data: { id, ownerId: actor.id, purpose: "GAME", status: "READY", previewAcceptedAt: new Date(),
      uploadKey: `${id}/source.bin`, displayKey: `${id}/display.webp`, thumbnailKey: `${id}/thumbnail.webp` } });
    for (const key of [asset.uploadKey, asset.displayKey, asset.thumbnailKey]) if (key) await app.get(LocalMediaStorage).write(key, photo);
    submitted.push(await ok("PUT", `/games/${session.id}/submission`, actor, { mediaId: id }));
  }
  state = await ok("GET", `/games/${session.id}`, actors[1]);
  await ok("POST", `/games/${session.id}/end-submission`, actors[1], { expectedVersion: state.version });
  const target = submitted[1].submissionId;
  await ok("PUT", `/games/${session.id}/submissions/${target}/rating`, actors[2], { stars: 5 });
  await ok("PUT", `/games/${session.id}/submissions/${target}/rating`, actors[1], { stars: 4 });
  await db.$transaction(async (tx) => { const row = await tx.gameSession.findUniqueOrThrow({ where: { id: session.id } }); await app.get(GameLifecycleService).complete(tx, row); });
  const before = await ok("GET", `/games/${session.id}/results`, actors[1]);
  await remove(actors[2]); await erase(actors[2]);
  const after = await ok("GET", `/games/${session.id}/results`, actors[1]);
  const result = after.items.find((row: any) => row.id === target);
  assert.equal(result.ratingCount, 2); assert.equal(result.ratingSum, 9); assert.deepEqual(after.items, before.items);
  assert.equal(await db.gameScore.count({ where: { sessionId: session.id, voterId: actors[2].id } }), 1);
});

test("silmeyle çakışan geç fotoğraf işlemesi READY kaydı canlandıramaz", async () => {
  const actor = actors[2]; const grant = await ok("POST", "/media/uploads", actor, { purpose: "POLL", mimeType: "image/webp", byteSize: photo.length, blurRequested: false });
  const id = grant.asset.id; const form = new FormData(); form.append("file", new Blob([photo], { type: "image/webp" }), "photo.webp");
  const uploaded = await fetch(`${origin}/v1/media/${id}/upload`, { method: "POST", headers: { Authorization: `Bearer ${actor.token}`, "X-Upload-Token": grant.upload.token }, body: form });
  assert.equal(uploaded.status, 200);
  const images = app.get(ImageProcessor); const originalProcess = images.process;
  let started!: () => void; let release!: () => void;
  const began = new Promise<void>((resolve) => { started = resolve; }); const gate = new Promise<void>((resolve) => { release = resolve; });
  images.process = async (...args: any[]) => { started(); await gate; return originalProcess.apply(images, args); };
  const processing = http("POST", `/media/${id}/complete`, actor, { confirmNoFaces: true });
  try {
    await began; assert.equal((await remove(actor)).status, 202); await erase(actor); release();
    assert.equal((await processing).status, 409);
    const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id } }); assert.equal(asset.status, "DELETED"); assert.equal(asset.displayKey, null);
    const directories = await app.get(LocalMediaStorage).oldAssetDirectories(new Date(Date.now() + 1000));
    // Gecikmiş işlem dosyalarını finally'de kaldırır; boş dizin scavenger ile temizlenir.
    if (directories.includes(id)) await app.get(LocalMediaStorage).removeAssetDirectory(id);
  } finally { release(); images.process = originalProcess; await processing; }
});

test("iki silme isteği tek iş üretir; eski oturumla servis yazmaları yeniden veri oluşturamaz", async () => {
  const replies = await Promise.all([remove(actors[2]), remove(actors[2])]);
  assert.equal(replies.filter((row) => row.status === 202).length, 1); assert.equal(replies.filter((row) => row.status === 401).length, 1);
  assert.equal(await db.accountDeletion.count({ where: { userId: actors[2].id } }), 1);
  await erase(actors[2]);
  await assert.rejects(app.get(MediaService).createUpload(actors[2].id, { purpose: "POLL", mimeType: "image/webp", byteSize: photo.length }));
  const spec = await ok("GET", "/openapi.json"); assert.ok(spec.paths["/v1/admin/users/{id}/deletion"]);
});
