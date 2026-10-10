import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { SocialAccessService as AccessService } from "../src/modules/social/social-access.service.js";

const { createApp } = await import(new URL("../dist/create-app.js", import.meta.url).href) as { createApp: () => Promise<NestExpressApplication> };
const { PrismaService } = await import(new URL("../dist/database/prisma.service.js", import.meta.url).href);
const { SocialAccessService } = await import(new URL("../dist/modules/social/social-access.service.js", import.meta.url).href);
type Account = { id: string; token: string; username: string };
let app: NestExpressApplication;
let db: PrismaClient;
let access: AccessService;
let base: string;
let marker: string;
let accounts: Account[];
const originalEnv = { NODE_ENV: process.env.NODE_ENV, AUTH_MOCK_ENABLED: process.env.AUTH_MOCK_ENABLED };

async function call(method: string, path: string, actor: Account | null = accounts[1], body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, body: await response.json() as any };
}

beforeEach(async () => {
  process.env.NODE_ENV = "test";
  process.env.AUTH_MOCK_ENABLED = "true";
  marker = `s_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  accounts = [];
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = `${await app.getUrl()}/v1`;
  db = app.get(PrismaService);
  access = app.get(SocialAccessService);
  for (let i = 0; i < 4; i++) {
    const session = await call("POST", "/auth/mock", null, { provider: "google", subject: `${marker}_${i}`, acknowledgeMock: true });
    assert.equal(session.status, 200);
    const actor = { id: "", token: session.body.accessToken, username: `${marker}_${i}` };
    const me = await call("GET", "/auth/me", actor);
    actor.id = me.body.user.id;
    accounts.push(actor);
    await db.user.update({ where: { id: actor.id }, data: { username: actor.username } });
  }
  // Ortadaki izleyici, kanonik arkadaşlık çiftinin iki tarafında da test edilir.
  accounts.sort((a, b) => a.id.localeCompare(b.id));
});

afterEach(async () => {
  try {
    if (db) {
      const users = await db.user.findMany({ where: { identities: { some: { issuer: "mock:google", subject: { startsWith: marker } } } }, select: { id: true } });
      const ids = users.map(({ id }) => id);
      await db.$transaction(async (tx) => {
        await tx.outboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
        await tx.block.deleteMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } });
        await tx.friendship.deleteMany({ where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } });
        await tx.poll.deleteMany({ where: { authorId: { in: ids } } });
        await tx.usedRefreshToken.deleteMany({ where: { session: { userId: { in: ids } } } });
        await tx.authSession.deleteMany({ where: { userId: { in: ids } } });
        await tx.authIdentity.deleteMany({ where: { userId: { in: ids } } });
        await tx.user.deleteMany({ where: { id: { in: ids } } });
      });
    }
  } finally {
    await app?.close();
    for (const key of ["NODE_ENV", "AUTH_MOCK_ENABLED"] as const) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
});

async function request(a: Account, b: Account) { return call("POST", "/friend-requests", a, { targetUserId: b.id }); }
async function accept(a: Account, b: Account) { return call("POST", `/friend-requests/${b.id}/accept`, a); }
async function befriend(a: Account, b: Account) {
  assert.equal((await request(a, b)).status, 200);
  assert.equal((await accept(b, a)).status, 200);
}
async function allPages(path: string, actor: Account) {
  const items: any[] = [];
  let cursor: string | null = null;
  do {
    const result = await call("GET", `${path}${path.includes("?") ? "&" : "?"}limit=1${cursor ? `&cursor=${cursor}` : ""}`, actor);
    assert.equal(result.status, 200);
    items.push(...result.body.items);
    cursor = result.body.nextCursor;
    assert.ok(items.length <= 10, "Cursor döngüsü oluşmamalı.");
  } while (cursor);
  return items;
}

test("sosyal uçlar oturum ister; UUID/body/query doğrulaması kimlik taklidini reddeder", async () => {
  const a = accounts[1];
  for (const [method, path] of [
    ["GET", `/users/search?q=${marker}`], ["GET", `/users/${a.id}/relationship`],
    ["GET", "/me/friends"], ["GET", "/me/friend-requests"], ["GET", "/me/blocks"],
    ["POST", "/friend-requests"], ["POST", `/friend-requests/${a.id}/accept`], ["POST", `/friend-requests/${a.id}/decline`],
    ["DELETE", `/friend-requests/${a.id}`], ["DELETE", `/friends/${a.id}`], ["PUT", `/blocks/${a.id}`], ["DELETE", `/blocks/${a.id}`],
  ]) assert.equal((await call(method, path, null)).status, 401, path);
  for (const body of [{}, { targetUserId: null }, { targetUserId: "invalid" }, { targetUserId: accounts[0].id, userId: accounts[2].id }]) {
    assert.equal((await call("POST", "/friend-requests", a, body)).status, 400);
  }
  for (const path of ["/users/invalid/relationship", "/me/friends?limit=51", "/me/friend-requests?direction=both", "/me/blocks?userId=other", "/users/search?q=x", "/users/search?q=a%25", "/users/search"]) {
    assert.equal((await call("GET", path, a)).status, 400, path);
  }
  for (const path of [`/friend-requests/${a.id}/accept`, `/friend-requests/${a.id}/decline`]) assert.equal((await call("POST", path, a)).status, 400);
  assert.equal((await request(a, a)).status, 400);
  assert.equal((await call("PUT", `/blocks/${a.id}`, a)).status, 400);
  assert.equal((await call("GET", `/users/${a.id}/relationship`, a)).body.state, "SELF");
});

test("çift/ters istek tek çifttir; yalnız alıcı kabul eder ve tekrar kabul yeni olay üretmez", async () => {
  const [b, a, c] = accounts;
  const first = await request(a, b);
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, { userId: b.id, state: "OUTGOING_REQUEST" });
  assert.deepEqual((await request(a, b)).body, first.body);
  const reverse = await request(b, a);
  assert.equal(reverse.status, 409);
  assert.equal(reverse.body.error.code, "INCOMING_REQUEST_EXISTS");
  assert.equal(await db.friendship.count({ where: { requesterId: a.id } }), 1);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: { in: [a.id, b.id] } } }), 2);
  assert.equal((await accept(a, b)).status, 409);
  assert.equal((await accept(c, a)).status, 404);
  assert.equal((await call("GET", `/users/${a.id}/relationship`, b)).body.state, "INCOMING_REQUEST");
  assert.equal((await accept(b, a)).body.state, "FRIENDS");
  assert.equal((await accept(b, a)).body.state, "FRIENDS");
  assert.equal((await request(a, b)).body.state, "FRIENDS");
  assert.equal((await call("GET", "/me", a)).body.profile.counts.friends, 1);
  assert.equal((await call("GET", "/me/friends", a)).body.items[0].user.id, b.id);
  assert.equal((await call("GET", "/me/friend-requests", b)).body.items.length, 0);
  const events = await db.outboxEvent.findMany({ where: { aggregateId: a.id }, orderBy: { aggregateVersion: "asc" } });
  assert.deepEqual(events.map((event) => event.aggregateVersion), [1, 2]);
  assert.deepEqual(events.map((event) => (event.payload as any).reason), ["REQUESTED", "ACCEPTED"]);
  assert.ok(events.every((event) => event.type === "social.relationship.changed" && event.publishedAt === null));
});

test("gelen/giden listeleri ayrıdır; iptal gönderene, red alıcıya aittir; yeniden istek mümkündür", async () => {
  const [b, a] = accounts;
  await request(a, b);
  assert.equal((await call("GET", "/me/friend-requests?direction=outgoing", a)).body.items[0].user.id, b.id);
  assert.equal((await call("GET", "/me/friend-requests", b)).body.items[0].user.id, a.id);
  assert.equal((await call("GET", "/me/friend-requests", a)).body.items.length, 0);
  assert.equal((await call("DELETE", `/friend-requests/${a.id}`, b)).status, 409);
  assert.equal((await call("POST", `/friend-requests/${b.id}/decline`, a)).status, 409);
  assert.equal((await call("DELETE", `/friends/${b.id}`, a)).status, 409);
  assert.equal((await call("DELETE", `/friend-requests/${b.id}`, a)).status, 200);
  assert.equal((await call("DELETE", `/friend-requests/${b.id}`, a)).status, 200);
  assert.equal((await accept(b, a)).status, 404);
  await request(a, b);
  const declined = await call("POST", `/friend-requests/${a.id}/decline`, b);
  assert.equal(declined.body.state, "NONE");
  const revision = (await db.user.findUniqueOrThrow({ where: { id: a.id } })).socialRevision;
  assert.equal((await call("POST", `/friend-requests/${a.id}/decline`, b)).status, 200);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: a.id } })).socialRevision, revision);
  assert.equal((await call("GET", "/me/friend-requests?direction=outgoing", a)).body.items.length, 0);
  assert.equal((await accept(b, a)).status, 404);
  assert.equal((await request(b, a)).body.state, "OUTGOING_REQUEST");
  assert.equal((await accept(a, b)).body.state, "FRIENDS");
  assert.equal((await call("POST", `/friend-requests/${b.id}/decline`, a)).status, 409);
  assert.equal((await call("DELETE", `/friend-requests/${b.id}`, a)).status, 409);
});

test("arkadaşlıktan çıkarma tekrar edilebilir; özel yayın erişimi sonraki istekte kapanır", async () => {
  const [b, a, c] = accounts;
  const now = new Date();
  const privatePoll = await db.poll.create({ data: { authorId: a.id, question: marker, category: "OUTFIT", visibility: "FRIENDS", status: "OPEN", publishedAt: now, closesAt: new Date(now.getTime() + 1800_000) } });
  const publicPoll = await db.poll.create({ data: { authorId: a.id, question: marker, category: "OUTFIT", status: "CLOSED", publishedAt: now, closesAt: new Date(now.getTime() + 1800_000) } });
  const canRead = (actor: Account, id: string) => db.$transaction((tx) => access.requirePublishedPollAccess(tx, actor.id, id));
  await assert.rejects(canRead(b, privatePoll.id));
  await befriend(a, b);
  assert.equal((await canRead(b, privatePoll.id)).id, privatePoll.id);
  await assert.rejects(canRead(c, privatePoll.id));
  assert.equal((await call("GET", `/users/${a.id}`, b)).body.counts.polls, 2);
  assert.equal((await call("DELETE", `/friends/${a.id}`, b)).body.state, "NONE");
  const revision = (await db.user.findUniqueOrThrow({ where: { id: b.id } })).socialRevision;
  assert.equal((await call("DELETE", `/friends/${a.id}`, b)).status, 200);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: b.id } })).socialRevision, revision);
  await assert.rejects(canRead(b, privatePoll.id));
  assert.equal((await canRead(b, publicPoll.id)).id, publicPoll.id);
  assert.equal((await call("GET", `/users/${a.id}`, b)).body.counts.polls, 1);
  assert.equal((await call("GET", "/me/friends", a)).body.items.length, 0);
  await db.poll.update({ where: { id: publicPoll.id }, data: { contentStatus: "HIDDEN" } });
  await assert.rejects(canRead(b, publicPoll.id));
});

test("engel arkadaşlığı kaldırır; iki yönlü erişimi keser; engeli açmak arkadaşlığı geri getirmez", async () => {
  const [b, a] = accounts;
  await befriend(a, b);
  assert.equal((await call("PUT", `/blocks/${b.id.toUpperCase()}`, a)).status, 200);
  const revision = (await db.user.findUniqueOrThrow({ where: { id: a.id } })).socialRevision;
  assert.equal((await call("PUT", `/blocks/${b.id}`, a)).status, 200);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: a.id } })).socialRevision, revision);
  for (const [viewer, target] of [[a, b], [b, a]]) {
    assert.equal((await call("GET", `/users/${target.id}`, viewer)).status, 404);
    assert.equal((await call("GET", `/users/${target.id}/relationship`, viewer)).status, 404);
    assert.equal((await request(viewer, target)).status, 404);
    assert.equal((await call("GET", "/me/friends", viewer)).body.items.length, 0);
    assert.ok(!(await call("GET", `/users/search?q=${marker}`, viewer)).body.items.some((item: any) => item.user.id === target.id));
  }
  assert.equal((await call("GET", "/me/blocks", a)).body.items[0].blockedUserId, b.id);
  assert.equal((await call("GET", "/me/blocks", b)).body.items.length, 0);
  assert.equal((await call("PUT", `/blocks/${a.id}`, b)).status, 200);
  assert.equal((await call("DELETE", `/blocks/${b.id}`, a)).status, 200);
  assert.equal((await call("GET", `/users/${b.id}`, a)).status, 404);
  assert.equal((await call("DELETE", `/blocks/${a.id}`, b)).status, 200);
  assert.equal((await call("GET", `/users/${b.id}/relationship`, a)).body.state, "NONE");
  assert.equal((await call("GET", "/me", a)).body.profile.counts.friends, 0);
  assert.equal((await call("GET", "/me/friends", b)).body.items.length, 0);
});

test("engel bekleyen isteği de siler; bilinmeyen/inaktif hedef ve engel listesi güvenli davranır", async () => {
  const [b, a, c] = accounts;
  await request(a, b);
  await call("PUT", `/blocks/${a.id}`, b);
  assert.equal((await call("GET", "/me/friend-requests?direction=outgoing", a)).body.items.length, 0);
  assert.equal((await call("GET", "/me/friend-requests", b)).body.items.length, 0);
  await call("DELETE", `/blocks/${a.id}`, b);
  assert.equal((await accept(b, a)).status, 404);
  await call("PUT", `/blocks/${c.id}`, a);
  await db.user.update({ where: { id: c.id }, data: { status: "DELETED" } });
  const blocked = (await call("GET", "/me/blocks", a)).body.items[0];
  assert.equal(blocked.blockedUserId, c.id);
  assert.equal(blocked.user, null);
  assert.equal((await call("DELETE", `/blocks/${c.id}`, a)).status, 200);
  for (const targetUserId of [c.id, randomUUID()]) {
    assert.equal((await call("POST", "/friend-requests", a, { targetUserId })).status, 404);
    assert.equal((await call("PUT", `/blocks/${targetUserId}`, a)).status, 404);
    assert.equal((await call("DELETE", `/blocks/${targetUserId}`, a)).status, 200);
  }
});

test("arama yalnız güvenli kullanıcı özetini döndürür; ilişki yönleri ve güncel engeller filtrelenir", async () => {
  const [b, a, c, d] = accounts;
  await request(a, b);
  await request(c, a);
  const result = await call("GET", `/users/search?q=${marker.toUpperCase()}`, a);
  assert.equal(result.status, 200);
  assert.equal(result.body.items.length, 3);
  const states = new Map(result.body.items.map((item: any) => [item.user.id, item.relationship]));
  assert.equal(states.get(b.id), "OUTGOING_REQUEST");
  assert.equal(states.get(c.id), "INCOMING_REQUEST");
  assert.equal(states.get(d.id), "NONE");
  for (const item of result.body.items) assert.deepEqual(Object.keys(item.user).sort(), ["displayName", "id", "username"]);
  await db.user.update({ where: { id: d.id }, data: { username: `${marker.replace("_", "x")}_decoy` } });
  assert.ok(!(await call("GET", `/users/search?q=${marker}`, a)).body.items.some((item: any) => item.user.id === d.id), "Alt çizgi wildcard gibi başka karakterle eşleşmemeli.");
  await call("PUT", `/blocks/${a.id}`, b);
  await db.user.update({ where: { id: d.id }, data: { status: "SUSPENDED" } });
  assert.deepEqual((await call("GET", `/users/search?q=${marker}`, a)).body.items.map((item: any) => item.user.id), [c.id]);
});

test("arama/arkadaş cursor'ları kullanıcı ve filtreye bağlıdır; eşit zamanda çiftin iki yönü sayfalanır", async () => {
  const a = accounts[1];
  const others = accounts.filter((user) => user.id !== a.id);
  const sameTime = new Date("2026-10-10T10:00:00.000Z");
  await db.user.updateMany({ where: { id: { in: accounts.map((user) => user.id) } }, data: { createdAt: sameTime } });
  const searched = await allPages(`/users/search?q=${marker}`, a);
  const expected = others.map((user) => user.id).sort().reverse();
  assert.deepEqual(searched.map((item) => item.user.id), expected);
  const cursor = (await call("GET", `/users/search?q=${marker}&limit=1`, a)).body.nextCursor;
  assert.equal((await call("GET", `/users/search?q=${marker}&cursor=${cursor}`, others[0])).status, 400);
  assert.equal((await call("GET", `/users/search?q=other&cursor=${cursor}`, a)).status, 400);
  assert.equal((await call("GET", `/me/friends?cursor=${cursor}`, a)).status, 400);
  for (const other of others) await befriend(a, other);
  await db.friendship.updateMany({ where: { OR: [{ userAId: a.id }, { userBId: a.id }] }, data: { createdAt: sameTime } });
  assert.deepEqual((await allPages("/me/friends", a)).map((item) => item.user.id), expected);
  const first = (await call("GET", "/me/friends?limit=1", a)).body;
  await call("DELETE", `/friends/${first.items[0].user.id}`, a);
  const afterRemoval = await call("GET", `/me/friends?limit=2&cursor=${first.nextCursor}`, a);
  assert.equal(afterRemoval.status, 200);
  assert.deepEqual(afterRemoval.body.items.map((item: any) => item.user.id), expected.slice(1));
});

test("gelen/giden istek ve engel listeleri eşit zamanlı kayıtlarda boşluk/tekrar üretmez", async () => {
  const a = accounts[1];
  const others = accounts.filter((user) => user.id !== a.id);
  const expected = others.map((user) => user.id).sort().reverse();
  const where = { OR: [{ userAId: a.id }, { userBId: a.id }] };
  const sameTime = new Date("2026-10-10T10:00:00.000Z");
  for (const other of others) await request(a, other);
  await db.friendship.updateMany({ where, data: { createdAt: sameTime } });
  assert.deepEqual((await allPages("/me/friend-requests?direction=outgoing", a)).map((item) => item.user.id), expected);
  const cursor = (await call("GET", "/me/friend-requests?direction=outgoing&limit=1", a)).body.nextCursor;
  assert.equal((await call("GET", `/me/friend-requests?direction=incoming&cursor=${cursor}`, a)).status, 400);
  for (const other of others) {
    await call("DELETE", `/friend-requests/${other.id}`, a);
    await request(other, a);
  }
  await db.friendship.updateMany({ where, data: { createdAt: sameTime } });
  assert.deepEqual((await allPages("/me/friend-requests?direction=incoming", a)).map((item) => item.user.id), expected);
  for (const other of others) await call("PUT", `/blocks/${other.id}`, a);
  await db.block.updateMany({ where: { blockerId: a.id }, data: { createdAt: sameTime } });
  assert.deepEqual((await allPages("/me/blocks", a)).map((item) => item.blockedUserId), expected);
  assert.equal((await call("GET", "/me/friend-requests", a)).body.items.length, 0);
});

test("outbox hatasında engel, istek silme ve her iki kullanıcının sürümü geri alınır", async () => {
  const [b, a] = accounts;
  await request(a, b);
  const original = db.$transaction.bind(db);
  const unbound = db.$transaction;
  (db as any).$transaction = (work: any, options: any) => original(async (tx) => work(new Proxy(tx, {
    get(target, key) {
      if (key !== "outboxEvent") return Reflect.get(target, key);
      return new Proxy(target.outboxEvent, { get(delegate, method) {
        if (method === "create") return async () => { throw new Error("TEST_SOCIAL_OUTBOX_FAILURE"); };
        return Reflect.get(delegate, method);
      } });
    },
  })), options);
  try {
    const failed = await call("PUT", `/blocks/${b.id}`, a);
    assert.equal(failed.status, 500);
    assert.ok(!JSON.stringify(failed.body).includes("TEST_SOCIAL_OUTBOX_FAILURE"));
  } finally { db.$transaction = unbound; }
  assert.equal(await db.block.count({ where: { blockerId: a.id } }), 0);
  assert.equal((await call("GET", `/users/${b.id}/relationship`, a)).body.state, "OUTGOING_REQUEST");
  for (const user of [a, b]) {
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).socialRevision, 1);
    assert.equal(await db.outboxEvent.count({ where: { aggregateId: user.id } }), 1);
  }
});

test("OpenAPI sosyal endpoint'leri, sayfalama ve Bearer sözleşmesini içerir", async () => {
  const { body: spec } = await call("GET", "/openapi.json", null);
  for (const [path, method] of [
    ["/v1/users/search", "get"], ["/v1/users/{userId}/relationship", "get"], ["/v1/me/friends", "get"],
    ["/v1/me/friend-requests", "get"], ["/v1/friend-requests", "post"], ["/v1/friend-requests/{userId}", "delete"],
    ["/v1/friend-requests/{userId}/accept", "post"], ["/v1/friend-requests/{userId}/decline", "post"],
    ["/v1/friends/{userId}", "delete"], ["/v1/me/blocks", "get"], ["/v1/blocks/{userId}", "put"], ["/v1/blocks/{userId}", "delete"],
  ]) {
    assert.ok(spec.paths[path][method].security.some((item: any) => "bearer" in item), path);
    assert.ok(spec.paths[path][method].responses[200].content["application/json"].schema, path);
  }
  assert.ok(spec.paths["/v1/users/search"].get.parameters.some((param: any) => param.name === "q" && param.required));
  assert.ok(spec.paths["/v1/users/search"].get.parameters.some((param: any) => param.name === "limit"));
  assert.ok(!("status" in spec.components.schemas.SocialUserResponseDto.properties));
});
